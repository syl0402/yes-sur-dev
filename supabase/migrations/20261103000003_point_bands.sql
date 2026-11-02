-- 포인트 숫자·시간 구간 정리 + 긴 설문 대충 응답 막기 (2026-11-03)
--
-- 문제: 실제 설문은 대부분 1~5분인데 "5분 미만" 한 구간이라 2문항이든 24문항이든 30P였다.
--       긴 설문일수록 1분당 보상이 적고(응답자가 안 모임), 80·75·40처럼 숫자가 애매했다.
-- 새 구간 (예상 시간, 각 구간 ≈ 1분에 10P · 등록비는 응답 보상의 정확히 절반):
--   1문항 10/5 · 3분 이내 30/15 · 3~7분 60/30 · 7~15분 100/50 · 15분 이상 200/100
-- 오늘의 질문 7일 연속 보너스 30 → 20, 커뮤니티 하루 최대 20 → 10 (설문보다 투표가 이득이지 않게)
-- 너무 빠른 응답: "문항 수 × 2초" → "예상 시간의 min_time_ratio(1/4) 미만"
--   (주관식 30개 설문을 1분에 "ㅇ"만 쓰고 200P 받는 것 막기. 고르는 문항만 있는 짧은 설문은 거의 그대로)
-- 이미 올라온 설문의 보상·등록비는 그대로 (설문마다 등록 때 값을 저장해 둠)

-- =========================================================
-- 1. 설정값
-- =========================================================
insert into public.point_rules (key, value, description) values
  ('reward_le3',     30,   '예상 3분 이내 설문 응답'),
  ('reward_3to7',    60,   '예상 3~7분 설문 응답'),
  ('reward_7to15',   100,  '예상 7~15분 설문 응답'),
  ('price_le3',      15,   '등록비: 예상 3분 이내 설문 응답 1명 받는 값'),
  ('price_3to7',     30,   '등록비: 예상 3~7분 설문 응답 1명 받는 값'),
  ('price_7to15',    50,   '등록비: 예상 7~15분 설문 응답 1명 받는 값'),
  ('min_time_ratio', 0.25, '응답 시간이 예상 시간의 이 비율보다 짧으면 성의 없는 응답으로 처리');

update public.point_rules set value = 200, description = '예상 15분 이상 설문 응답' where key = 'reward_gte15';
update public.point_rules set value = 100, description = '등록비: 예상 15분 이상 설문 응답 1명 받는 값' where key = 'price_gte15';
update public.point_rules set value = 20 where key = 'streak_bonus';
update public.point_rules set value = 10 where key = 'community_daily_cap';

-- 더 이상 쓰지 않는 값 (지우지 않고 표시만)
update public.point_rules set description = '(2026-11-03부터 사용 안 함) ' || description
 where key in ('reward_lt5', 'reward_5to15', 'price_lt5', 'price_5to15',
               'balance_vote', 'balance_daily_cap', 'early_bird_rate', 'cost_survey_create',
               'min_seconds_per_question')
   and description not like '(%사용 안 함%';

-- =========================================================
-- 2. 구간 계산 (이름·입력 그대로, 본문만 교체). 예상 분은 올림한 정수
-- =========================================================
create or replace function public.calc_survey_reward(p_question_count integer, p_est_minutes integer)
returns integer
language plpgsql
stable
set search_path = ''
as $$
declare
  v_key text;
  v_value integer;
begin
  if p_question_count = 1 then
    v_key := 'reward_1q';
  elsif p_est_minutes <= 3 then
    v_key := 'reward_le3';
  elsif p_est_minutes <= 7 then
    v_key := 'reward_3to7';
  elsif p_est_minutes < 15 then
    v_key := 'reward_7to15';
  else
    v_key := 'reward_gte15';
  end if;

  select value::integer into v_value from public.point_rules where key = v_key;
  if v_value is null then
    raise exception 'rule_missing';
  end if;
  return v_value;
end;
$$;

create or replace function public.calc_survey_price(p_question_count integer, p_est_minutes integer)
returns integer
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_question_count = 1 then
    return public.point_rule('price_1q');
  elsif p_est_minutes <= 3 then
    return public.point_rule('price_le3');
  elsif p_est_minutes <= 7 then
    return public.point_rule('price_3to7');
  elsif p_est_minutes < 15 then
    return public.point_rule('price_7to15');
  end if;
  return public.point_rule('price_gte15');
end;
$$;

-- =========================================================
-- 3. submit_response: 너무 빠른 응답 기준만 바뀜 (나머지는 20261031000001과 같음)
-- 예상 시간(초) = 문항마다 sec_per_text(주관식) · sec_per_choice(나머지), 설문 만들 때와 같은 계산
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
