-- 새 포인트 규칙·확인 문항 오답 처리 확인용 테스트 (2026-10-30)
-- 20261030000005_point_economy.sql 적용 후 SQL Editor에서 Run.
-- 마지막에 일부러 오류를 내서 테스트로 만든 데이터는 전부 취소된다 (DB에 남지 않음).
-- 결과는 빨간 오류 창의 "테스트 결과" 아래에 나온다.
-- 필요한 것: 학생 테스터 1명, 승인된 단체 테스터 1명

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' and approval_status = 'approved' order by created_at limit 1);
  v_category bigint := (select id from public.survey_categories where key = 'life');
  v_five jsonb := '[
    {"type": "single", "text": "하나", "options": ["가", "나"]},
    {"type": "multi",  "text": "여럿", "options": ["가", "나", "다"]},
    {"type": "scale",  "text": "척도"},
    {"type": "text",   "text": "주관식"},
    {"type": "single", "text": "하나 더", "options": ["예", "아니요"]}
  ]';
  v_mine bigint;
  v_org_survey bigint;
  v_before integer;
  v_after integer;
  v_q record;
  v_wrong jsonb := '[]';
  v_right jsonb := '[]';
  v_first bigint;
  v_other bigint;
  v_result jsonb;
  v_log text := E'\n';
begin
  if v_student is null or v_org is null then
    raise exception '학생 테스터와 승인된 단체 테스터가 필요해요';
  end if;

  -- 학생에게 테스트용 1,000P (블록 끝에서 같이 취소됨)
  insert into public.point_ledger (user_id, amount, status, reason, ref_id)
  values (v_student, 1000, 'confirmed', 'survey_reward', 'test-topup');

  -- 1. 학생 등록: 5문항 → 2분 → 5분 미만 → 1명당 15P × 50명 = 750P, 응답자 보상 30P
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  v_before := public.get_my_balance();
  v_mine := public.create_survey(gen_random_uuid(), v_category, '내 설문', null, 'all', 50, 7, v_five);
  v_after := public.get_my_balance();
  v_log := v_log || format('1. 학생 등록: 차감 %sP(750) · 1명당 값 %sP(15) · 응답자 보상 %sP(30)',
    v_before - v_after,
    (select price_per_response from public.surveys where id = v_mine),
    (select reward_points from public.surveys where id = v_mine)) || E'\n';

  -- 2. 조기 마감: 응답 0명 → 50명 × 15P = 750P 환불. 두 번 마감해도 한 번만
  perform public.close_survey(v_mine);
  perform public.close_survey(v_mine);
  v_log := v_log || format('2. 조기 마감 환불: 잔액 %sP(처음과 같음 %s) · 환불 기록 %s개(1)',
    public.get_my_balance(), v_before,
    (select count(*) from public.point_ledger where reason = 'survey_refund' and ref_id = v_mine::text)) || E'\n';

  -- 3. 단체 등록: 비용 0, 1명당 값 0
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  v_org_survey := public.create_survey(gen_random_uuid(), v_category, '단체 설문', null, 'all', 10, 3, v_five);
  v_log := v_log || format('3. 단체 등록: 1명당 값 %sP(0) · 차감 기록 %s개(0)',
    (select price_per_response from public.surveys where id = v_org_survey),
    (select count(*) from public.point_ledger where reason = 'survey_create' and ref_id = v_org_survey::text)) || E'\n';

  -- 답 만들기: 확인 문항만 틀린 답(v_wrong) / 모두 맞은 답(v_right)
  for v_q in select id, type, is_attention_check, correct_option_id
               from public.questions where survey_id = v_org_survey order by sort_order loop
    select id into v_first from public.question_options where question_id = v_q.id order by sort_order limit 1;
    if v_q.is_attention_check then
      select id into v_other from public.question_options
       where question_id = v_q.id and id <> v_q.correct_option_id limit 1;
      v_wrong := v_wrong || jsonb_build_array(jsonb_build_object('question_id', v_q.id, 'option_ids', jsonb_build_array(v_other)));
      v_right := v_right || jsonb_build_array(jsonb_build_object('question_id', v_q.id, 'option_ids', jsonb_build_array(v_q.correct_option_id)));
    else
      v_wrong := v_wrong || case v_q.type
        when 'scale' then jsonb_build_array(jsonb_build_object('question_id', v_q.id, 'scale_value', 3))
        when 'text' then jsonb_build_array(jsonb_build_object('question_id', v_q.id, 'text_value', '좋아요'))
        else jsonb_build_array(jsonb_build_object('question_id', v_q.id, 'option_ids', jsonb_build_array(v_first)))
      end;
    end if;
  end loop;
  -- 맞은 답 = 틀린 답에서 확인 문항만 바꾼 것
  select jsonb_agg(coalesce(
           (select r from jsonb_array_elements(v_right) r where r ->> 'question_id' = w ->> 'question_id'), w))
    into v_right
    from jsonb_array_elements(v_wrong) w;

  -- 4. 학생이 확인 문항을 틀림 → 포인트 0, 반려, 응답 수 안 오름
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  v_before := public.get_my_balance();
  v_result := public.submit_response(v_org_survey, v_wrong, 42);
  v_log := v_log || format('4. 확인 문항 오답: 통과 %s(false) · 보상 %s(0) · 잔액 변화 %s(0) · 응답 수 %s(0) · 상태 %s(rejected) · 걸린 시간 %s초(42)',
    v_result ->> 'passed', v_result ->> 'reward', public.get_my_balance() - v_before,
    (select response_count from public.surveys where id = v_org_survey),
    (select status from public.responses where survey_id = v_org_survey and user_id = v_student),
    (select duration_seconds from public.responses where survey_id = v_org_survey and user_id = v_student)) || E'\n';

  -- 5. 다시 응답(맞게) → 30P, 응답 수 1, 응답은 1개만 남음
  v_result := public.submit_response(v_org_survey, v_right);
  v_log := v_log || format('5. 다시 응답: 통과 %s(true) · 보상 %s(30) · 잔액 변화 %s(30) · 응답 수 %s(1) · 남은 응답 %s개(1)',
    v_result ->> 'passed', v_result ->> 'reward', public.get_my_balance() - v_before,
    (select response_count from public.surveys where id = v_org_survey),
    (select count(*) from public.responses where survey_id = v_org_survey and user_id = v_student)) || E'\n';

  -- 6. 통과한 뒤 또 응답 → already_responded
  begin
    perform public.submit_response(v_org_survey, v_right);
    v_log := v_log || E'6. 통과 후 또 응답: ❌ 통과됨\n';
  exception when others then
    v_log := v_log || '6. 통과 후 또 응답: ' || sqlerrm || E'(already_responded)\n';
  end;

  -- 7. 새 포인트 기록 이유가 들어가는지 (열람 수익)
  begin
    insert into public.point_ledger (user_id, amount, status, reason, ref_id)
    values (v_org, 40, 'confirmed', 'data_share', 'test');
    v_log := v_log || E'7. 열람 수익 기록: 들어감(OK)\n';
  exception when others then
    v_log := v_log || '7. 열람 수익 기록: ❌ ' || sqlerrm || E'\n';
  end;

  raise exception '테스트 결과 (만든 데이터는 모두 취소됨):%', v_log;
end;
$$;
