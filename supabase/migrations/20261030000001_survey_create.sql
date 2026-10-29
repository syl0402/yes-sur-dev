-- 설문 2단계 A: 설문 등록 함수, 4종 문항 응답, 주의 문항 정답 숨기기 (2026-10-30)
--
-- 1. point_rules: 소요시간 계산·등록 한도 설정값
-- 2. surveys.request_id: 등록 버튼 연타·재시도 때 설문이 두 번 만들어지지 않게
-- 3. questions: 주의 문항 정답 칸을 앱에서 못 읽게 (칸 단위 권한)
-- 4. point_rule(): 설정값 읽기 도우미
-- 5. create_survey(): 설문 등록 + 비용 차감 (한 번에)
-- 6. submit_response(): 4종 문항(단일·복수·척도·주관식) 답 받기

-- =========================================================
-- 1. 설정값 (숫자는 여기서만. 바꿀 때는 대시보드에서 point_rules만 고친다)
-- =========================================================
insert into public.point_rules (key, value, description) values
  ('sec_per_choice',          10,  '고르는 문항(단일·복수·척도) 1개 예상 시간(초)'),
  ('sec_per_text',            40,  '주관식 문항 1개 예상 시간(초)'),
  ('survey_max_questions',    30,  '설문 1개 최대 문항 수'),
  ('survey_max_options',      10,  '문항 1개 최대 선택지 수'),
  ('survey_min_target',       10,  '목표 응답 수 최소'),
  ('survey_max_target',       300, '목표 응답 수 최대'),
  ('survey_default_target',   50,  '목표 응답 수 기본값 (작성 화면)'),
  ('survey_max_days',         14,  '마감까지 최대 일수'),
  ('survey_default_days',     7,   '마감까지 기본 일수 (작성 화면)'),
  ('attention_min_questions', 5,   '이 문항 수 이상이면 주의 문항 1개 자동 추가'),
  ('answer_text_max',         500, '주관식 답 최대 글자 수'),
  -- TODO(임시): 단체 설문 등록 무료 · Q14 기획팀 답이 오면 변경 · 2026-10-30 결정
  ('cost_survey_create_org',  0,   '단체 설문 등록 비용 (테스트 기간 무료)');

-- =========================================================
-- 2. 등록 요청 번호: 같은 요청이 두 번 와도 설문은 하나만
-- =========================================================
alter table public.surveys add column request_id uuid;

alter table public.surveys
  add constraint surveys_owner_request_unique unique (owner_id, request_id);

-- =========================================================
-- 3. 주의 문항 정답 숨기기
-- 앱은 문항의 번호·순서·종류·내용만 읽는다. 정답·주의 문항 표시는 서버 함수만 쓴다
-- =========================================================
revoke select on public.questions from authenticated;
grant select (id, survey_id, sort_order, type, text) on public.questions to authenticated;

-- =========================================================
-- 4. point_rule: 설정값 하나 읽기 (없으면 오류)
-- =========================================================
create function public.point_rule(p_key text)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare
  v_value numeric;
begin
  select value into v_value from public.point_rules where key = p_key;
  if v_value is null then
    raise exception 'rule_missing';
  end if;
  return v_value;
end;
$$;

revoke execute on function public.point_rule(text) from public, anon;
grant execute on function public.point_rule(text) to authenticated;

-- =========================================================
-- 5. create_survey: 설문 등록 + 비용 차감 (하나라도 실패하면 전부 취소)
-- p_questions 예:
--   [{"type": "single", "text": "자주 가는 곳은?", "options": ["도서관", "카페"]},
--    {"type": "scale",  "text": "만족도는?"},
--    {"type": "text",   "text": "바라는 점은?"}]
-- 돌려주는 값: 만든 설문 번호 (같은 p_request_id로 다시 부르면 처음 만든 번호)
-- =========================================================
create function public.create_survey(
  p_request_id uuid,
  p_category_id bigint,
  p_title text,
  p_description text,
  p_audience text,
  p_target integer,
  p_days integer,
  p_questions jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_existing bigint;
  v_title text := btrim(coalesce(p_title, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_count integer;
  v_max_options integer;
  v_q jsonb;
  v_type text;
  v_option jsonb;
  v_option_count integer;
  v_seconds integer := 0;
  v_est_minutes integer;
  v_reward integer;
  v_cost integer;
  v_balance integer;
  v_survey_id bigint;
  v_question_id bigint;
  v_order integer := 0;
  v_attention_at integer := 0;
  v_pick integer;
  v_correct bigint;
  v_i integer;
  v_scale_labels text[] := array['전혀 아니에요', '아니에요', '보통이에요', '그래요', '매우 그래요'];
begin
  -- 1. 로그인한 학생 또는 승인된 단체만
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- 회원정보 행을 잠근다: 같은 사람의 등록이 동시에 와도 하나씩 처리돼 잔액이 음수가 되지 않는다
  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'not_authenticated';
  end if;

  if v_profile.account_type = 'org' then
    if v_profile.approval_status <> 'approved' then
      raise exception 'org_not_approved';
    end if;
  elsif v_profile.account_type <> 'student' then
    raise exception 'not_allowed';
  end if;

  -- 2. 같은 요청이 이미 처리됐으면 그 설문 번호만 돌려준다 (비용 다시 안 뺌)
  if p_request_id is null then
    raise exception 'invalid_request';
  end if;
  select id into v_existing from public.surveys where owner_id = v_uid and request_id = p_request_id;
  if v_existing is not null then
    return v_existing;
  end if;

  -- 3. 기본 정보 검사
  if char_length(v_title) < 2 or char_length(v_title) > 60 then
    raise exception 'invalid_title';
  end if;
  if v_description is not null and char_length(v_description) > 500 then
    raise exception 'invalid_description';
  end if;
  if not exists (select 1 from public.survey_categories where id = p_category_id) then
    raise exception 'invalid_category';
  end if;
  if coalesce(p_audience, '') not in ('all', 'campus')
     or (p_audience = 'campus' and v_profile.university_id is null) then
    raise exception 'invalid_audience';
  end if;
  if p_target is null
     or p_target < public.point_rule('survey_min_target')
     or p_target > public.point_rule('survey_max_target') then
    raise exception 'invalid_target';
  end if;
  if p_days is null or p_days < 1 or p_days > public.point_rule('survey_max_days') then
    raise exception 'invalid_days';
  end if;

  -- 4. 문항 검사 + 예상 시간 합산
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' then
    raise exception 'invalid_questions';
  end if;
  v_count := jsonb_array_length(p_questions);
  if v_count < 1 or v_count > public.point_rule('survey_max_questions') then
    raise exception 'invalid_questions';
  end if;
  v_max_options := public.point_rule('survey_max_options');

  for v_q in select * from jsonb_array_elements(p_questions) loop
    v_type := v_q ->> 'type';
    if coalesce(v_type, '') not in ('single', 'multi', 'scale', 'text')
       or char_length(btrim(coalesce(v_q ->> 'text', ''))) not between 1 and 200 then
      raise exception 'invalid_questions';
    end if;

    if v_type in ('single', 'multi') then
      if jsonb_typeof(v_q -> 'options') is distinct from 'array' then
        raise exception 'invalid_questions';
      end if;
      v_option_count := jsonb_array_length(v_q -> 'options');
      if v_option_count < 2 or v_option_count > v_max_options then
        raise exception 'invalid_questions';
      end if;
      for v_option in select * from jsonb_array_elements(v_q -> 'options') loop
        if jsonb_typeof(v_option) <> 'string'
           or char_length(btrim(v_option #>> '{}')) not between 1 and 100 then
          raise exception 'invalid_questions';
        end if;
      end loop;
    end if;

    if v_type = 'text' then
      v_seconds := v_seconds + public.point_rule('sec_per_text');
    else
      v_seconds := v_seconds + public.point_rule('sec_per_choice');
    end if;
  end loop;

  -- 5. 소요시간·보상·비용 (모두 서버가 정한다)
  v_est_minutes := greatest(1, ceil(v_seconds / 60.0)::integer);
  v_reward := public.calc_survey_reward(v_count, v_est_minutes);

  if v_profile.account_type = 'org' then
    v_cost := public.point_rule('cost_survey_create_org');
  else
    v_cost := public.point_rule('cost_survey_create');
  end if;

  select coalesce(sum(amount), 0)::integer into v_balance
    from public.point_ledger
   where user_id = v_uid and status = 'confirmed';
  if v_cost > 0 and v_balance < v_cost then
    raise exception 'insufficient_points';
  end if;

  -- 6. 설문 저장
  insert into public.surveys (
    owner_id, category_id, title, description, question_count, est_minutes, reward_points,
    target_responses, audience, university_id, closes_at, request_id
  ) values (
    v_uid, p_category_id, v_title, v_description, v_count, v_est_minutes, v_reward,
    p_target, p_audience,
    case when p_audience = 'campus' then v_profile.university_id end,
    now() + make_interval(days => p_days), p_request_id
  )
  returning id into v_survey_id;

  -- 주의 문항 위치: 문항이 기준 이상이면 가운데쯤에 1개 (문항 수·보상 계산에는 안 넣는다)
  if v_count >= public.point_rule('attention_min_questions') then
    v_attention_at := v_count / 2;
  end if;

  -- 7. 문항·선택지 저장
  v_i := 0;
  for v_q in select * from jsonb_array_elements(p_questions) loop
    v_i := v_i + 1;
    v_order := v_order + 1;
    v_type := v_q ->> 'type';

    insert into public.questions (survey_id, sort_order, type, text)
    values (v_survey_id, v_order, v_type, btrim(v_q ->> 'text'))
    returning id into v_question_id;

    if v_type in ('single', 'multi') then
      insert into public.question_options (question_id, sort_order, text)
      select v_question_id, o.ord, btrim(o.value #>> '{}')
        from jsonb_array_elements(v_q -> 'options') with ordinality as o(value, ord);
    end if;

    -- 주의 문항: 정답을 무작위로 골라 문구에 넣는다 (매번 같은 답이면 외워서 통과할 수 있음)
    if v_i = v_attention_at then
      v_order := v_order + 1;
      v_pick := 1 + floor(random() * 5)::integer;

      insert into public.questions (survey_id, sort_order, type, text, is_attention_check)
      values (
        v_survey_id, v_order, 'single',
        format('성실한 응답 확인용 문항이에요. ''%s''를 골라 주세요.', v_scale_labels[v_pick]),
        true
      )
      returning id into v_question_id;

      insert into public.question_options (question_id, sort_order, text)
      select v_question_id, l.ord, l.label
        from unnest(v_scale_labels) with ordinality as l(label, ord);

      select id into v_correct
        from public.question_options
       where question_id = v_question_id and sort_order = v_pick;

      update public.questions set correct_option_id = v_correct where id = v_question_id;
    end if;
  end loop;

  -- 8. 비용 차감 (고유 제약으로 설문당 1번)
  if v_cost > 0 then
    insert into public.point_ledger (user_id, amount, status, reason, ref_id)
    values (v_uid, -v_cost, 'confirmed', 'survey_create', v_survey_id::text);
  end if;

  return v_survey_id;
end;
$$;

revoke execute on function public.create_survey(uuid, bigint, text, text, text, integer, integer, jsonb)
  from public, anon;
grant execute on function public.create_survey(uuid, bigint, text, text, text, integer, integer, jsonb)
  to authenticated;

-- =========================================================
-- 6. submit_response: 4종 문항 답 받기 (검사·저장·보상은 기존과 같다)
-- p_answers 예:
--   [{"question_id": 1, "option_ids": [3]},        단일 (예전 형식 "option_id": 3 도 받는다)
--    {"question_id": 2, "option_ids": [7, 8]},     복수
--    {"question_id": 3, "scale_value": 4},         척도 1~5
--    {"question_id": 4, "text_value": "좋아요"}]   주관식
-- =========================================================
create or replace function public.submit_response(p_survey_id bigint, p_answers jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_account_type text;
  v_my_university bigint;
  v_survey public.surveys%rowtype;
  v_total integer;
  v_response_id bigint;
  v_a jsonb;
  v_question public.questions%rowtype;
  v_option_ids bigint[];
  v_scale integer;
  v_text text;
  v_text_max integer;
begin
  -- 1. 로그인한 학생만 응답할 수 있다 (단체 계정은 응답 불가)
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select account_type, university_id
    into v_account_type, v_my_university
    from public.profiles
   where id = v_uid;

  if v_account_type is distinct from 'student' then
    raise exception 'not_student';
  end if;

  -- 2. 설문 확인. 행을 잠가서 동시에 여러 명이 제출해도 목표 인원을 넘지 않게 한다
  select * into v_survey from public.surveys where id = p_survey_id for update;
  if not found then
    raise exception 'survey_not_found';
  end if;

  if v_survey.owner_id = v_uid then
    raise exception 'own_survey';
  end if;

  if v_survey.status <> 'open'
     or (v_survey.closes_at is not null and v_survey.closes_at <= now()) then
    raise exception 'survey_closed';
  end if;

  if v_survey.response_count >= v_survey.target_responses then
    raise exception 'survey_full';
  end if;

  if v_survey.audience = 'campus'
     and v_survey.university_id is distinct from v_my_university then
    raise exception 'not_target';
  end if;

  -- 3. 같은 설문은 한 번만
  if exists (
    select 1 from public.responses where survey_id = p_survey_id and user_id = v_uid
  ) then
    raise exception 'already_responded';
  end if;

  -- 4. 모든 문항에 한 번씩 답했는지 (빠짐·중복 확인)
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'invalid_answers';
  end if;

  select count(*) into v_total from public.questions where survey_id = p_survey_id;

  if v_total = 0
     or jsonb_array_length(p_answers) <> v_total
     or (
       select count(distinct q.id)
         from jsonb_array_elements(p_answers) a
         join public.questions q
           on q.id = (a ->> 'question_id')::bigint
          and q.survey_id = p_survey_id
     ) <> v_total then
    raise exception 'invalid_answers';
  end if;

  -- 5. 응답 저장 후 문항마다 답 검사·저장 (하나라도 틀리면 오류 → 전부 취소)
  insert into public.responses (survey_id, user_id)
  values (p_survey_id, v_uid)
  returning id into v_response_id;

  v_text_max := public.point_rule('answer_text_max');

  for v_a in select * from jsonb_array_elements(p_answers) loop
    select * into v_question from public.questions where id = (v_a ->> 'question_id')::bigint;
    v_option_ids := null;
    v_scale := null;
    v_text := null;

    if v_question.type in ('single', 'multi') then
      if jsonb_typeof(v_a -> 'option_ids') = 'array' then
        select array_agg(distinct x::bigint) into v_option_ids
          from jsonb_array_elements_text(v_a -> 'option_ids') x;
      elsif v_a ? 'option_id' then
        v_option_ids := array[(v_a ->> 'option_id')::bigint];
      end if;

      if v_option_ids is null
         or (v_question.type = 'single' and cardinality(v_option_ids) <> 1)
         or (
           select count(*) from public.question_options o
            where o.question_id = v_question.id and o.id = any (v_option_ids)
         ) <> cardinality(v_option_ids) then
        raise exception 'invalid_answers';
      end if;
    elsif v_question.type = 'scale' then
      v_scale := (v_a ->> 'scale_value')::integer;
      if v_scale is null or v_scale not between 1 and 5 then
        raise exception 'invalid_answers';
      end if;
    else
      v_text := btrim(coalesce(v_a ->> 'text_value', ''));
      if char_length(v_text) < 1 or char_length(v_text) > v_text_max then
        raise exception 'invalid_answers';
      end if;
    end if;

    insert into public.answers (response_id, question_id, option_ids, scale_value, text_value)
    values (v_response_id, v_question.id, v_option_ids, v_scale, v_text);
  end loop;

  -- 6. 보상 지급 (금액은 설문에 저장된 서버 계산값, 고유 제약으로 설문당 1번만)
  insert into public.point_ledger (user_id, amount, status, reason, ref_id)
  values (v_uid, v_survey.reward_points, 'confirmed', 'survey_reward', p_survey_id::text)
  on conflict do nothing;

  -- 7. 응답 수 +1, 목표에 도달하면 자동 마감
  update public.surveys
     set response_count = response_count + 1,
         status = case when response_count + 1 >= target_responses then 'closed' else status end
   where id = p_survey_id;

  return v_survey.reward_points;
end;
$$;
