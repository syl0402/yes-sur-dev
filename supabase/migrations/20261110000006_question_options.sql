-- 문항 옵션 (2026-11-10 개인 피드백 7번)
--   - 주관식 선택 문항: questions.is_required (기본 true, false는 주관식만). 건너뛴 응답자도 보상은 같다
--   - 보기 순서 섞기: questions.shuffle_options (고르기 문항만, 앱이 섞는다. 해당 없음·기타는 맨 아래)
--   - "해당 없음"·"기타 (직접 입력)" 보기: question_options.kind ('none'·'other', 문항마다 하나씩, 문구 고정)
--     기타에 적은 글은 answers.text_value에 저장 → 작성자 결과·원본 CSV에만 (공개 결과에는 기타 인원만)
-- 바뀌는 함수: create_survey · submit_response · get_survey_results · get_survey_raw · get_survey_for_copy
-- 보상·등록비 계산은 바뀌지 않는다 (문항 수·종류로만)

-- =========================================================
-- 1. 칸 추가
-- =========================================================
alter table public.questions add column is_required boolean not null default true;
alter table public.questions add column shuffle_options boolean not null default false;
alter table public.questions add constraint questions_required_text_only check (is_required or type = 'text');

alter table public.question_options add column kind text not null default 'normal'
  check (kind in ('normal', 'none', 'other'));
-- 문항마다 해당 없음·기타는 하나씩만
create unique index question_options_one_special on public.question_options (question_id, kind)
  where kind <> 'normal';

-- 앱이 문항의 새 칸을 읽을 수 있게 (questions는 칸마다 허용한다. 정답 칸은 계속 못 읽음)
grant select (is_required, shuffle_options) on public.questions to authenticated;

-- 문항 jsonb에서 true/false 설정 읽기. 없으면 기본값, true/false가 아니면 invalid_questions
create or replace function public.question_flag(p_q jsonb, p_key text, p_default boolean)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if not (p_q ? p_key) or jsonb_typeof(p_q -> p_key) = 'null' then
    return p_default;
  end if;
  if jsonb_typeof(p_q -> p_key) <> 'boolean' then
    raise exception 'invalid_questions';
  end if;
  return (p_q ->> p_key)::boolean;
end;
$$;

-- =========================================================
-- 2. create_survey: 문항마다 required·shuffle·none·other(모두 선택, true/false)를 받는다
--    20261030000006과 같고, 문항 옵션 검사·저장만 추가 (매개변수는 그대로)
--    p_questions 한 개: {"type": "single", "text": "…", "options": ["…"], "shuffle": true, "none": true, "other": true}
--                       {"type": "text", "text": "…", "required": false}
-- =========================================================
create or replace function public.create_survey(
  p_request_id uuid,
  p_category_id bigint,
  p_title text,
  p_description text,
  p_audience text,
  p_target integer,
  p_days integer,
  p_questions jsonb,
  p_result_visibility text default 'public'
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
  v_price integer;
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

  if coalesce(p_result_visibility, '') not in ('public', 'campus', 'private')
     or (p_result_visibility = 'campus' and v_profile.university_id is null) then
    raise exception 'invalid_visibility';
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

    -- 문항 옵션 (2026-11-10): 선택 문항은 주관식만, 섞기·해당 없음·기타는 고르기 문항만
    if not public.question_flag(v_q, 'required', true) and v_type <> 'text' then
      raise exception 'invalid_questions';
    end if;
    if (public.question_flag(v_q, 'shuffle', false)
        or public.question_flag(v_q, 'none', false)
        or public.question_flag(v_q, 'other', false))
       and v_type not in ('single', 'multi') then
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
    -- TODO(임시): 단체는 테스트 동안 무료 (cost_survey_create_org) · Q14 답이 오면 변경
    v_price := 0;
    v_cost := public.point_rule('cost_survey_create_org');
  else
    v_price := public.calc_survey_price(v_count, v_est_minutes);
    v_cost := v_price * p_target;
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
    target_responses, audience, university_id, closes_at, request_id, price_per_response,
    result_visibility, result_university_id
  ) values (
    v_uid, p_category_id, v_title, v_description, v_count, v_est_minutes, v_reward,
    p_target, p_audience,
    case when p_audience = 'campus' then v_profile.university_id end,
    now() + make_interval(days => p_days), p_request_id, v_price,
    p_result_visibility, case when p_result_visibility = 'campus' then v_profile.university_id end
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

    insert into public.questions (survey_id, sort_order, type, text, is_required, shuffle_options)
    values (v_survey_id, v_order, v_type, btrim(v_q ->> 'text'),
            public.question_flag(v_q, 'required', true), public.question_flag(v_q, 'shuffle', false))
    returning id into v_question_id;

    if v_type in ('single', 'multi') then
      insert into public.question_options (question_id, sort_order, text)
      select v_question_id, o.ord, btrim(o.value #>> '{}')
        from jsonb_array_elements(v_q -> 'options') with ordinality as o(value, ord);

      -- 해당 없음·기타는 일반 보기 뒤에 (문구는 서버가 정한다)
      v_option_count := jsonb_array_length(v_q -> 'options');
      if public.question_flag(v_q, 'none', false) then
        insert into public.question_options (question_id, sort_order, text, kind)
        values (v_question_id, v_option_count + 1, '해당 없음', 'none');
      end if;
      if public.question_flag(v_q, 'other', false) then
        insert into public.question_options (question_id, sort_order, text, kind)
        values (v_question_id, v_option_count + 2, '기타 (직접 입력)', 'other');
      end if;
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


-- =========================================================
-- 3. submit_response: 선택 문항 건너뛰기 · 기타 글 · 해당 없음은 혼자만
--    20261103000003과 같고 5번(문항마다 답 검사)만 바뀐다
--    앱은 지금처럼 모든 문항을 보낸다. 건너뛴 선택 주관식은 text_value ""
--    기타를 고르면 {"question_id": 1, "option_ids": [3], "other_text": "…"} (1~100자)
-- =========================================================
create or replace function public.submit_response(
  p_survey_id bigint,
  p_answers jsonb,
  p_duration_seconds integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_account_type text;
  v_my_university bigint;
  v_survey public.surveys%rowtype;
  v_previous public.responses%rowtype;
  v_total integer;
  v_response_id bigint;
  v_a jsonb;
  v_question public.questions%rowtype;
  v_option_ids bigint[];
  v_scale integer;
  v_text text;
  v_text_max integer;
  v_passed boolean;
  v_est_seconds numeric;
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

  -- 3. 같은 설문은 한 번만. 단, 반려된 응답(확인 문항 오답·너무 빠름)은 지우고 다시 받는다
  select * into v_previous from public.responses where survey_id = p_survey_id and user_id = v_uid;
  if found then
    if v_previous.status = 'confirmed' then
      raise exception 'already_responded';
    end if;
    delete from public.responses where id = v_previous.id;
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
  insert into public.responses (survey_id, user_id, duration_seconds)
  values (p_survey_id, v_uid, case when p_duration_seconds >= 0 then p_duration_seconds end)
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

      -- 해당 없음은 다른 보기와 같이 고를 수 없다 (여러 개 고르기)
      if cardinality(v_option_ids) > 1 and exists (
           select 1 from public.question_options o where o.id = any (v_option_ids) and o.kind = 'none') then
        raise exception 'invalid_answers';
      end if;

      -- 기타를 골랐으면 적은 글 1~100자 (text_value에 저장, 작성자만 본다). 아니면 글은 버린다
      if exists (select 1 from public.question_options o where o.id = any (v_option_ids) and o.kind = 'other') then
        v_text := btrim(coalesce(v_a ->> 'other_text', ''));
        if char_length(v_text) < 1 or char_length(v_text) > 100 then
          raise exception 'invalid_answers';
        end if;
      end if;
    elsif v_question.type = 'scale' then
      v_scale := (v_a ->> 'scale_value')::integer;
      if v_scale is null or v_scale not between 1 and 5 then
        raise exception 'invalid_answers';
      end if;
    else
      v_text := btrim(coalesce(v_a ->> 'text_value', ''));
      -- 선택 문항을 비우면 답을 저장하지 않는다 (그 문항 "응답 n명"에서 빠진다)
      if v_text = '' and not v_question.is_required then
        continue;
      end if;
      if char_length(v_text) < 1 or char_length(v_text) > v_text_max then
        raise exception 'invalid_answers';
      end if;
    end if;

    insert into public.answers (response_id, question_id, option_ids, scale_value, text_value)
    values (v_response_id, v_question.id, v_option_ids, v_scale, v_text);
  end loop;

  -- 6. 확인 문항: 모두 정답이어야 통과 (확인 문항이 없으면 통과)
  v_passed := not exists (
    select 1
      from public.questions q
     where q.survey_id = p_survey_id
       and q.is_attention_check
       and not exists (
         select 1 from public.answers a
          where a.response_id = v_response_id
            and a.question_id = q.id
            and q.correct_option_id = any (a.option_ids)
       )
  );

  -- 틀리면 반려: 포인트 없음, 목표 인원에 안 셈 (다시 응답하면 이 응답은 지워진다)
  if not v_passed then
    update public.responses set status = 'rejected' where id = v_response_id;
    return jsonb_build_object('reward', 0, 'passed', false, 'reason', 'attention');
  end if;

  -- 6-2. 너무 빠른 응답: 예상 시간의 min_time_ratio보다 짧으면 확인 문항 오답과 같게 처리
  select sum(case when q.type = 'text' then public.point_rule('sec_per_text')
                  else public.point_rule('sec_per_choice') end)
    into v_est_seconds
    from public.questions q
   where q.survey_id = p_survey_id;

  if p_duration_seconds is not null and p_duration_seconds >= 0
     and p_duration_seconds < v_est_seconds * public.point_rule('min_time_ratio') then
    update public.responses set status = 'rejected' where id = v_response_id;
    return jsonb_build_object('reward', 0, 'passed', false, 'reason', 'too_fast');
  end if;

  -- 7. 보상 지급 (금액은 설문에 저장된 서버 계산값, 고유 제약으로 설문당 1번만)
  insert into public.point_ledger (user_id, amount, status, reason, ref_id)
  values (v_uid, v_survey.reward_points, 'confirmed', 'survey_reward', p_survey_id::text)
  on conflict do nothing;

  -- 8. 응답 수 +1, 목표에 도달하면 자동 마감
  update public.surveys
     set response_count = response_count + 1,
         status = case when response_count + 1 >= target_responses then 'closed' else status end
   where id = p_survey_id;

  return jsonb_build_object('reward', v_survey.reward_points, 'passed', true);
end;
$$;


-- =========================================================
-- 4. get_survey_results (작성자 결과): 고르기 문항에 'other_texts'(기타에 적은 글, 최신순) 추가,
--    보기마다 'kind' 추가. 20261030000005와 같고 이 두 가지만 늘었다
-- =========================================================
create or replace function public.get_survey_results(p_survey_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_valid bigint[];
  v_all integer;
  v_questions jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select owner_id into v_owner from public.surveys where id = p_survey_id;
  if not found then
    raise exception 'survey_not_found';
  end if;
  if v_owner <> v_uid then
    raise exception 'not_owner';
  end if;

  -- 전체 응답 (확인 문항을 틀려 반려된 응답 포함)
  select count(*) into v_all from public.responses where survey_id = p_survey_id;

  -- 유효 응답: 확정된 응답 중 확인 문항마다 정답을 고른 것 (확인 문항이 없으면 전부)
  select coalesce(array_agg(r.id), '{}') into v_valid
    from public.responses r
   where r.survey_id = p_survey_id
     and r.status = 'confirmed'
     and not exists (
       select 1
         from public.questions q
        where q.survey_id = p_survey_id
          and q.is_attention_check
          and not exists (
            select 1
              from public.answers a
             where a.response_id = r.id
               and a.question_id = q.id
               and q.correct_option_id = any (a.option_ids)
          )
     );

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', q.id,
             'type', q.type,
             'text', q.text,
             'answered', (
               select count(*) from public.answers a
                where a.question_id = q.id and a.response_id = any (v_valid)
             ),
             'options', case when q.type in ('single', 'multi') then (
               select coalesce(jsonb_agg(
                        jsonb_build_object(
                          'id', o.id,
                          'text', o.text,
                          'kind', o.kind,
                          'count', (
                            select count(*) from public.answers a
                             where a.question_id = q.id
                               and a.response_id = any (v_valid)
                               and o.id = any (a.option_ids)
                          )
                        ) order by o.sort_order), '[]'::jsonb)
                 from public.question_options o
                where o.question_id = q.id
             ) else '[]'::jsonb end,
             'other_texts', case when q.type in ('single', 'multi') then (
               select coalesce(jsonb_agg(a.text_value order by r.submitted_at desc), '[]'::jsonb)
                 from public.answers a
                 join public.responses r on r.id = a.response_id
                where a.question_id = q.id and a.response_id = any (v_valid) and a.text_value is not null
             ) else '[]'::jsonb end,
             'scale', case when q.type = 'scale' then (
               select jsonb_build_object(
                        'avg', round(avg(a.scale_value)::numeric, 1),
                        'counts', jsonb_build_array(
                          count(*) filter (where a.scale_value = 1),
                          count(*) filter (where a.scale_value = 2),
                          count(*) filter (where a.scale_value = 3),
                          count(*) filter (where a.scale_value = 4),
                          count(*) filter (where a.scale_value = 5)
                        )
                      )
                 from public.answers a
                where a.question_id = q.id and a.response_id = any (v_valid)
             ) end,
             'texts', case when q.type = 'text' then (
               select coalesce(jsonb_agg(a.text_value order by r.submitted_at desc), '[]'::jsonb)
                 from public.answers a
                 join public.responses r on r.id = a.response_id
                where a.question_id = q.id and a.response_id = any (v_valid)
             ) else '[]'::jsonb end
           ) order by q.sort_order), '[]'::jsonb)
    into v_questions
    from public.questions q
   where q.survey_id = p_survey_id
     and not q.is_attention_check;

  return jsonb_build_object(
    'total', cardinality(v_valid),
    'excluded', v_all - cardinality(v_valid),
    'questions', v_questions
  );
end;
$$;


-- =========================================================
-- 5. get_survey_raw (작성자 원본 CSV): 기타를 고른 칸에 적은 글을 붙인다 → "기타 (직접 입력): 적은 글"
--    20261030000015와 같고 고르기 칸만 바뀐다
-- =========================================================
create or replace function public.get_survey_raw(p_survey_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_ids bigint[];
  v_min numeric := public.point_rule('result_min_count');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select owner_id into v_owner from public.surveys where id = p_survey_id;
  if not found then
    raise exception 'survey_not_found';
  end if;
  if v_owner is distinct from v_uid then
    raise exception 'not_owner';
  end if;

  v_ids := public.survey_valid_ids(p_survey_id);

  return jsonb_build_object(
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'text', q.text, 'type', q.type) order by q.sort_order), '[]'::jsonb)
        from public.questions q
       where q.survey_id = p_survey_id and not q.is_attention_check),
    'rows', (
      with r as (
        select id,
               coalesce(grp_major, '미입력') as major,
               coalesce(grp_grade, '미입력') as grade,
               coalesce(grp_gender, '미입력') as gender,
               coalesce(grp_age, '미입력') as age
          from public.responses
         where id = any (v_ids)
      ),
      -- 인원이 적은 그룹은 이름을 가린다
      m as (
        select id,
               case when count(*) over (partition by major) < v_min then '5명 미만' else major end as major,
               case when count(*) over (partition by grade) < v_min then '5명 미만' else grade end as grade,
               case when count(*) over (partition by gender) < v_min then '5명 미만' else gender end as gender,
               case when count(*) over (partition by age) < v_min then '5명 미만' else age end as age
          from r
      )
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'major', m.major,
                 'grade', m.grade,
                 'gender', m.gender,
                 'age', m.age,
                 'answers', (
                   select coalesce(jsonb_agg(
                            case q.type
                              when 'scale' then a.scale_value::text
                              when 'text' then a.text_value
                              else (select string_agg(
                                             case when o.kind = 'other' and a.text_value is not null
                                                  then o.text || ': ' || a.text_value
                                                  else o.text end,
                                             ' | ' order by o.sort_order)
                                      from public.question_options o
                                     where o.id = any (a.option_ids))
                            end order by q.sort_order), '[]'::jsonb)
                     from public.questions q
                     left join public.answers a on a.question_id = q.id and a.response_id = m.id
                    where q.survey_id = p_survey_id and not q.is_attention_check)
               ) order by md5(m.id::text)), '[]'::jsonb)
        from m)
  );
end;
$$;


-- =========================================================
-- 6. get_survey_for_copy (처음부터 다시 고치기): 문항 옵션도 돌려준다. 보기는 일반 보기만
--    모양: [{ "type", "text", "options": [...], "required", "shuffle", "none", "other" }]
-- =========================================================
create or replace function public.get_survey_for_copy(p_survey_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select owner_id into v_owner from public.surveys where id = p_survey_id;
  if not found then
    raise exception 'survey_not_found';
  end if;
  if v_owner <> v_uid then
    raise exception 'not_owner';
  end if;

  return coalesce((
    select jsonb_agg(
             jsonb_build_object(
               'type', q.type,
               'text', q.text,
               'options', coalesce((select jsonb_agg(o.text order by o.sort_order)
                                      from public.question_options o
                                     where o.question_id = q.id and o.kind = 'normal'), '[]'::jsonb),
               'required', q.is_required,
               'shuffle', q.shuffle_options,
               'none', exists (select 1 from public.question_options o where o.question_id = q.id and o.kind = 'none'),
               'other', exists (select 1 from public.question_options o where o.question_id = q.id and o.kind = 'other')
             )
             order by q.sort_order)
      from public.questions q
     where q.survey_id = p_survey_id and not q.is_attention_check
  ), '[]'::jsonb);
end;
$$;
