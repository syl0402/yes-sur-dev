-- 너무 빠른 응답 걸러 내기 (2026-10-31)
--
-- 응답 화면을 연 뒤 제출까지 걸린 시간이 "문항 수 × min_seconds_per_question초"보다 짧으면
-- 확인 문항 오답과 같게 처리한다: 보상 없음 · 결과에서 빠짐(rejected) · 다시 응답 가능.
-- 사람이 읽고 고를 수 없는 속도라 성실한 응답자는 거의 걸리지 않는다. 기준은 point_rules (테스트 후 조정)
-- 응답 시간이 오지 않으면(예전 앱) 검사하지 않는다.
-- 돌려주는 값에 reason 추가: attention(확인 문항 오답) / too_fast(너무 빠름) → 완료 화면 안내 문구
-- 나머지는 20261030000005의 submit_response와 같다
-- (일자 응답 걸러 내기는 테스트 데이터를 보고 나중에, 2026-10-31 결정)

insert into public.point_rules (key, value, description) values
  ('min_seconds_per_question', 2, '응답이 이보다 빠르면(문항당 초) 성의 없는 응답으로 처리');

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
    return jsonb_build_object('reward', 0, 'passed', false, 'reason', 'attention');
  end if;

  -- 6-2. 너무 빠른 응답: 확인 문항 오답과 같게 처리
  if p_duration_seconds is not null and p_duration_seconds >= 0
     and p_duration_seconds < v_total * public.point_rule('min_seconds_per_question') then
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
