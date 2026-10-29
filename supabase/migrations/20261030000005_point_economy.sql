-- 포인트 구조 다시 짜기 + 확인 문항 오답 처리 (2026-10-30)
--
-- 이유: 응답 보상은 앱이 크게 주는데(300~3,000P) 등록비는 700P 고정이라 포인트가 끝없이 불어났다.
-- - 응답 보상(앱이 지급)은 작게: 1문항 10 · 5분 미만 30 · 5~15분 80 · 15분 이상 150P
-- - 등록비 = "응답 1명 받는 값" × 목표 인원. 1명당 1문항 5 · 5분 미만 15 · 5~15분 40 · 15분 이상 75P
-- - 조기 마감하면 못 받은 인원 × 1명당 값을 돌려준다. 연장은 없다
-- - 확인 문항을 틀린 응답: 포인트 미지급, 목표 인원에 안 셈, 다시 응답 가능
-- - 응답에 걸린 시간(초)을 저장한다 (나중에 무성의 응답 필터를 만들 때 쓰려고. 지금은 쓰지 않음)
-- 모든 숫자는 point_rules 설정값. 이미 등록된 설문의 보상은 그대로 둔다

-- =========================================================
-- 1. 설정값
-- =========================================================
update public.point_rules set value = 10  where key = 'reward_1q';
update public.point_rules set value = 30  where key = 'reward_lt5';
update public.point_rules set value = 80  where key = 'reward_5to15';
update public.point_rules set value = 150 where key = 'reward_gte15';
update public.point_rules set value = 100 where key = 'cost_data_view';
update public.point_rules set description = '(2026-10-30부터 사용 안 함. 등록비는 price_* × 목표 인원)'
 where key = 'cost_survey_create';

insert into public.point_rules (key, value, description) values
  ('price_1q',        5,   '등록비: 1문항 설문 응답 1명 받는 값'),
  ('price_lt5',       15,  '등록비: 5분 미만 설문 응답 1명 받는 값'),
  ('price_5to15',     40,  '등록비: 5~15분 설문 응답 1명 받는 값'),
  ('price_gte15',     75,  '등록비: 15분 이상 설문 응답 1명 받는 값'),
  ('data_share_rate', 0.4, '데이터 열람료 중 공개한 등록자에게 주는 비율');

-- =========================================================
-- 2. 표 바꾸기
-- =========================================================
-- 포인트 기록 이유에 환불·열람 수익 추가 (이름 없이 만든 check라 찾아서 지운다)
do $$
declare
  v_name text;
begin
  select conname into v_name
    from pg_constraint
   where conrelid = 'public.point_ledger'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%reason%';
  if v_name is not null then
    execute format('alter table public.point_ledger drop constraint %I', v_name);
  end if;
end;
$$;

alter table public.point_ledger add constraint point_ledger_reason_check
  check (reason in ('welcome', 'survey_reward', 'survey_create', 'survey_refund',
                    'data_view', 'data_share', 'balance_vote'));

-- 설문마다 등록 때 정한 "1명당 값"을 저장 (환불 계산용. 예전 설문·단체 설문은 0)
alter table public.surveys add column price_per_response integer not null default 0
  check (price_per_response >= 0);

-- 응답에 걸린 시간(초). 앱이 보낸 값이라 참고용
alter table public.responses add column duration_seconds integer
  check (duration_seconds is null or duration_seconds >= 0);

-- =========================================================
-- 3. calc_survey_price: 응답 1명 받는 값 (calc_survey_reward와 같은 구간)
-- =========================================================
create function public.calc_survey_price(p_question_count integer, p_est_minutes integer)
returns integer
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_question_count = 1 then
    return public.point_rule('price_1q');
  elsif p_est_minutes < 5 then
    return public.point_rule('price_lt5');
  elsif p_est_minutes < 15 then
    return public.point_rule('price_5to15');
  end if;
  return public.point_rule('price_gte15');
end;
$$;

revoke execute on function public.calc_survey_price(integer, integer) from public, anon;
grant execute on function public.calc_survey_price(integer, integer) to authenticated;

-- =========================================================
-- 4. create_survey: 등록비 = 1명당 값 × 목표 인원 (단체는 cost_survey_create_org, 테스트 동안 0)
-- 20261030000002와 같고, 비용 계산과 price_per_response 저장만 바뀐다
-- 작성자 표시는 트리거(surveys_set_host)가 채운다
-- =========================================================
create or replace function public.create_survey(
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
    target_responses, audience, university_id, closes_at, request_id, price_per_response
  ) values (
    v_uid, p_category_id, v_title, v_description, v_count, v_est_minutes, v_reward,
    p_target, p_audience,
    case when p_audience = 'campus' then v_profile.university_id end,
    now() + make_interval(days => p_days), p_request_id, v_price
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

-- =========================================================
-- 5. submit_response: 확인 문항 오답 처리 + 다시 응답 + 응답 시간
-- 돌려주는 값이 바뀌어서(숫자 → {reward, passed}) 지우고 다시 만든다
-- p_duration_seconds: 응답 화면을 연 뒤 제출까지 걸린 초 (참고용, 없어도 됨)
-- 돌려주는 값: { "reward": 받은 포인트, "passed": 확인 문항 통과 여부 }
-- =========================================================
drop function public.submit_response(bigint, jsonb);

create function public.submit_response(
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

  -- 3. 같은 설문은 한 번만. 단, 확인 문항을 틀려 반려된 응답은 지우고 다시 받는다
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
    return jsonb_build_object('reward', 0, 'passed', false);
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

revoke execute on function public.submit_response(bigint, jsonb, integer) from public, anon;
grant execute on function public.submit_response(bigint, jsonb, integer) to authenticated;

-- =========================================================
-- 6. close_survey: 마감하면서 못 받은 인원만큼 환불 (작성자 본인만)
-- 진행 중 → 마감으로 바뀔 때만 환불한다. 이미 마감이면 아무것도 안 함
-- 환불액 = (목표 인원 - 응답 수) × 등록 때 정한 1명당 값. 고유 제약으로 설문당 1번
-- =========================================================
create or replace function public.close_survey(p_survey_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_survey public.surveys%rowtype;
  v_refund integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- 응답 제출과 동시에 와도 순서대로 처리되게 설문 행을 잠근다
  select * into v_survey from public.surveys where id = p_survey_id for update;
  if not found then
    raise exception 'survey_not_found';
  end if;
  if v_survey.owner_id <> v_uid then
    raise exception 'not_owner';
  end if;
  if v_survey.status <> 'open' then
    return;
  end if;

  update public.surveys set status = 'closed' where id = p_survey_id;

  v_refund := greatest(v_survey.target_responses - v_survey.response_count, 0) * v_survey.price_per_response;
  if v_refund > 0 then
    insert into public.point_ledger (user_id, amount, status, reason, ref_id)
    values (v_uid, v_refund, 'confirmed', 'survey_refund', p_survey_id::text)
    on conflict do nothing;
  end if;
end;
$$;

-- =========================================================
-- 7. get_survey_results: 반려된 응답도 "뺀 응답" 건수에 넣는다
-- 20261030000004와 같고, 전체 응답 수(v_all)를 반려 포함으로 센다
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
