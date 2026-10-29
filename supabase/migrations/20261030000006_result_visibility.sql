-- 결과 공개 범위 (2026-10-30)
--
-- 설문마다 결과를 누가 볼 수 있는지 정한다. 응답 대상(audience)과는 따로다.
-- - public  전체 공개 (기본) → 마감·응답 5개 이상이면 데이터 허브에 올라간다
-- - campus  우리 학교만 → 작성자 학교 학생만 (작성자 학교를 result_university_id에 저장)
-- - private 비공개 → 작성자만. 그 설문에 응답한 사람도 못 본다 (2026-10-30 결정)
-- 공개 범위를 좁혀도 이미 열람한 사람은 계속 볼 수 있다 (열람 기능에서 처리)
-- 등록할 때 함께 저장한다 (따로 저장하면 중간 실패 시 "비공개"가 "전체"로 남을 수 있음)

-- =========================================================
-- 1. 칸 추가
-- =========================================================
alter table public.surveys
  add column result_visibility text not null default 'public'
    check (result_visibility in ('public', 'campus', 'private')),
  add column result_university_id bigint references public.universities (id);

alter table public.surveys
  add constraint surveys_result_campus_school
    check (result_visibility <> 'campus' or result_university_id is not null);

-- =========================================================
-- 2. set_result_visibility: 등록한 뒤 공개 범위 바꾸기 (작성자 본인만)
-- =========================================================
create function public.set_result_visibility(p_survey_id bigint, p_visibility text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_school bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select owner_id into v_owner from public.surveys where id = p_survey_id for update;
  if not found then
    raise exception 'survey_not_found';
  end if;
  if v_owner <> v_uid then
    raise exception 'not_owner';
  end if;

  select university_id into v_school from public.profiles where id = v_uid;
  if coalesce(p_visibility, '') not in ('public', 'campus', 'private')
     or (p_visibility = 'campus' and v_school is null) then
    raise exception 'invalid_visibility';
  end if;

  update public.surveys
     set result_visibility = p_visibility,
         result_university_id = case when p_visibility = 'campus' then v_school end
   where id = p_survey_id;
end;
$$;

revoke execute on function public.set_result_visibility(bigint, text) from public, anon;
grant execute on function public.set_result_visibility(bigint, text) to authenticated;

-- =========================================================
-- 3. create_survey: 공개 범위를 함께 받는다 (매개변수가 늘어서 지우고 다시 만든다)
-- 20261030000005와 같고, p_result_visibility 검사·저장만 추가
-- =========================================================
drop function public.create_survey(uuid, bigint, text, text, text, integer, integer, jsonb);

create function public.create_survey(
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

revoke execute on function public.create_survey(uuid, bigint, text, text, text, integer, integer, jsonb, text)
  from public, anon;
grant execute on function public.create_survey(uuid, bigint, text, text, text, integer, integer, jsonb, text)
  to authenticated;
