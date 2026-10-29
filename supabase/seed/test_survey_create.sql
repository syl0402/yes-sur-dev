-- 설문 등록·4종 응답 확인용 테스트 (2026-10-30)
-- 20261030000001_survey_create.sql 적용 후 SQL Editor에서 Run.
-- 마지막에 일부러 오류를 내서 테스트로 만든 데이터는 전부 취소된다 (DB에 남지 않음).
-- 결과는 빨간 오류 창의 "테스트 결과" 아래에 나온다.
-- 필요한 것: 학생 테스터 1명, 승인된 단체 테스터 1명

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' and approval_status = 'approved' limit 1);
  v_category bigint := (select id from public.survey_categories where key = 'study');
  v_request uuid := gen_random_uuid();
  v_five jsonb := '[
    {"type": "single", "text": "자주 공부하는 곳은?", "options": ["도서관", "카페"]},
    {"type": "multi",  "text": "쓰는 앱을 모두 골라 주세요", "options": ["노션", "굿노트", "구글 캘린더"]},
    {"type": "scale",  "text": "지금 공부 습관에 만족하나요?"},
    {"type": "text",   "text": "바라는 점을 적어 주세요"},
    {"type": "single", "text": "하루 공부 시간은?", "options": ["2시간 미만", "2시간 이상"]}
  ]';
  v_four jsonb := '[
    {"type": "single", "text": "단일", "options": ["가", "나"]},
    {"type": "multi",  "text": "복수", "options": ["가", "나", "다"]},
    {"type": "scale",  "text": "척도"},
    {"type": "text",   "text": "주관식"}
  ]';
  v_id bigint;
  v_id2 bigint;
  v_org_survey bigint;
  v_scale_survey bigint;
  v_before integer;
  v_after integer;
  v_answers jsonb := '[]';
  v_q record;
  v_reward integer;
  v_log text := E'\n';
begin
  if v_student is null or v_org is null then
    raise exception '학생 테스터와 승인된 단체 테스터가 필요해요';
  end if;

  -- 학생에게 테스트용 1,000P (블록 끝에서 같이 취소됨)
  insert into public.point_ledger (user_id, amount, status, reason, ref_id)
  values (v_student, 1000, 'confirmed', 'survey_reward', 'test-topup');

  -- ===== 학생으로 =====
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  v_before := public.get_my_balance();

  -- 1. 정상 등록 (5문항 → 주의 문항 1개 추가, 80초 → 2분, 보상 30P, 등록비 15P × 50명 = 750P)
  v_id := public.create_survey(v_request, v_category, '테스트 설문', null, 'all', 50, 7, v_five);
  v_after := public.get_my_balance();
  select format('1. 등록: 문항 줄 %s개(기대 6) · 주의 문항 %s개(1) · 소요 %s분(2) · 보상 %sP(30) · 차감 %sP(750)',
                (select count(*) from public.questions where survey_id = v_id),
                (select count(*) from public.questions where survey_id = v_id and is_attention_check and correct_option_id is not null),
                s.est_minutes, s.reward_points, v_before - v_after) || E'\n'
    into v_log from public.surveys s where s.id = v_id;
  v_log := E'\n' || v_log;

  -- 2. 같은 요청 번호로 다시 → 같은 설문, 추가 차감 없음
  v_id2 := public.create_survey(v_request, v_category, '테스트 설문', null, 'all', 50, 7, v_five);
  v_log := v_log || format('2. 연타: 같은 설문 %s(true) · 추가 차감 %sP(0)', v_id2 = v_id, v_after - public.get_my_balance()) || E'\n';

  -- 3~5. 잘못된 입력은 거절
  begin
    perform public.create_survey(gen_random_uuid(), v_category, '짧', null, 'all', 50, 7, v_five);
    v_log := v_log || E'3. 제목 1자: ❌ 통과됨\n';
  exception when others then
    v_log := v_log || '3. 제목 1자: ' || sqlerrm || E'(invalid_title)\n';
  end;

  begin
    perform public.create_survey(gen_random_uuid(), v_category, '테스트 설문', null, 'all', 5, 7, v_five);
    v_log := v_log || E'4. 목표 5명: ❌ 통과됨\n';
  exception when others then
    v_log := v_log || '4. 목표 5명: ' || sqlerrm || E'(invalid_target)\n';
  end;

  begin
    perform public.create_survey(gen_random_uuid(), v_category, '테스트 설문', null, 'all', 50, 7,
      '[{"type": "single", "text": "선택지 하나", "options": ["가"]}]');
    v_log := v_log || E'5. 선택지 1개: ❌ 통과됨\n';
  exception when others then
    v_log := v_log || '5. 선택지 1개: ' || sqlerrm || E'(invalid_questions)\n';
  end;

  -- ===== 단체로 =====
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);

  -- 6. 단체 등록 (테스트 기간 무료 → 차감 기록 없음)
  v_org_survey := public.create_survey(gen_random_uuid(), v_category, '단체 테스트 설문', '설명', 'all', 10, 3, v_four);
  v_scale_survey := public.create_survey(gen_random_uuid(), v_category, '척도 하나', null, 'all', 10, 3,
    '[{"type": "scale", "text": "척도"}]');
  v_log := v_log || format('6. 단체 등록: 차감 기록 %s개(0)',
    (select count(*) from public.point_ledger where reason = 'survey_create' and ref_id = v_org_survey::text)) || E'\n';

  -- ===== 다시 학생으로: 4종 응답 =====
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);

  for v_q in select id, type from public.questions where survey_id = v_org_survey order by sort_order loop
    v_answers := v_answers || case v_q.type
      when 'single' then jsonb_build_array(jsonb_build_object('question_id', v_q.id,
        'option_ids', (select jsonb_agg(id) from (select id from public.question_options where question_id = v_q.id order by sort_order limit 1) o)))
      when 'multi' then jsonb_build_array(jsonb_build_object('question_id', v_q.id,
        'option_ids', (select jsonb_agg(id) from public.question_options where question_id = v_q.id)))
      when 'scale' then jsonb_build_array(jsonb_build_object('question_id', v_q.id, 'scale_value', 4))
      else jsonb_build_array(jsonb_build_object('question_id', v_q.id, 'text_value', '좋아요'))
    end;
  end loop;

  -- 7. 4종 응답 제출 (4문항, 70초 → 2분 → 보상 30P)
  v_reward := (public.submit_response(v_org_survey, v_answers) ->> 'reward')::integer;
  v_log := v_log || format('7. 4종 응답: 보상 %sP(30) · 저장된 답 %s개(4) · 복수 선택 %s개(3) · 척도 %s(4) · 주관식 %s(좋아요)',
    v_reward,
    (select count(*) from public.answers a join public.responses r on r.id = a.response_id where r.survey_id = v_org_survey),
    (select max(cardinality(a.option_ids)) from public.answers a join public.responses r on r.id = a.response_id where r.survey_id = v_org_survey),
    (select max(a.scale_value) from public.answers a join public.responses r on r.id = a.response_id where r.survey_id = v_org_survey),
    (select max(a.text_value) from public.answers a join public.responses r on r.id = a.response_id where r.survey_id = v_org_survey)) || E'\n';

  -- 8. 척도 범위 밖(9) → 거절
  begin
    perform public.submit_response(v_scale_survey, jsonb_build_array(jsonb_build_object(
      'question_id', (select id from public.questions where survey_id = v_scale_survey), 'scale_value', 9)));
    v_log := v_log || E'8. 척도 9: ❌ 통과됨\n';
  exception when others then
    v_log := v_log || '8. 척도 9: ' || sqlerrm || E'(invalid_answers)\n';
  end;

  -- 9. 앱 권한으로 주의 문항 정답 칸 읽기 → 막혀야 함
  execute 'set local role authenticated';
  begin
    perform (select correct_option_id from public.questions limit 1);
    v_log := v_log || E'9. 정답 칸 읽기: ❌ 읽힘\n';
  exception when insufficient_privilege then
    v_log := v_log || E'9. 정답 칸 읽기: 막힘(OK)\n';
  end;

  raise exception '테스트 결과 (만든 데이터는 모두 취소됨):%', v_log;
end;
$$;
