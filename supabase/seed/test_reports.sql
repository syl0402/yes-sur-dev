-- 신고 기능(20261030000014) 확인용 테스트 (2026-10-30)
-- 마이그레이션 적용 후 SQL Editor에서 Run.
-- 마지막에 일부러 오류를 내서 테스트로 바꾼 내용은 전부 취소된다 (DB에 남지 않음).
-- 테스터가 학생 1명뿐이라, 블록 안에서만 "3명 신고하면 숨김" 기준을 1로 낮춰서 확인한다.

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' and approval_status = 'approved' order by created_at limit 1);
  v_category bigint := (select id from public.survey_categories where key = 'life');
  v_one jsonb := '[{"type": "single", "text": "하나", "options": ["가", "나"]}]';
  v_survey bigint;
  v_option bigint;
  v_log text := E'\n';
begin
  if v_student is null or v_org is null then
    raise exception '학생 테스터와 승인된 단체 테스터가 필요해요';
  end if;
  update public.point_rules set value = 1 where key = 'report_hide_count';

  -- 단체가 설문 등록
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  v_survey := public.create_survey(gen_random_uuid(), v_category, '신고 테스트', null, 'all', 10, 3, v_one);

  -- 1. 본인 설문은 신고 못 함
  begin
    perform public.report_survey(v_survey, 'spam');
    v_log := v_log || E'1. 본인 설문 신고: ❌ 됨\n';
  exception when others then
    v_log := v_log || '1. 본인 설문 신고: ' || sqlerrm || E'(report_own_survey)\n';
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);

  -- 2. 사유가 틀리면 거절
  begin
    perform public.report_survey(v_survey, 'boring');
    v_log := v_log || E'2. 틀린 사유: ❌ 됨\n';
  exception when others then
    v_log := v_log || '2. 틀린 사유: ' || sqlerrm || E'(invalid_reason)\n';
  end;

  -- 3. 학생이 신고 → 기준 1명이라 숨김
  perform public.report_survey(v_survey, 'spam', '광고 같아요');
  v_log := v_log || format('3. 신고 후 상태: %s(hidden)',
    (select moderation from public.surveys where id = v_survey)) || E'\n';

  -- 4. 같은 설문 다시 신고 → 거절
  begin
    perform public.report_survey(v_survey, 'abuse');
    v_log := v_log || E'4. 중복 신고: ❌ 됨\n';
  exception when others then
    v_log := v_log || '4. 중복 신고: ' || sqlerrm || E'(already_reported)\n';
  end;

  -- 5. 학생에게는 숨긴 설문이 안 보임 (RLS 적용을 위해 역할을 authenticated로)
  set local role authenticated;
  v_log := v_log || format('5. 학생에게 보이는 숨긴 설문 수: %s(0)',
    (select count(*) from public.surveys where id = v_survey)) || E'\n';
  reset role;

  -- 6. 숨긴 설문에 응답 → 거절
  select id into v_option from public.question_options
   where question_id = (select id from public.questions where survey_id = v_survey order by sort_order limit 1)
   order by sort_order limit 1;
  begin
    perform public.submit_response(v_survey,
      jsonb_build_array(jsonb_build_object(
        'question_id', (select id from public.questions where survey_id = v_survey order by sort_order limit 1),
        'option_ids', jsonb_build_array(v_option))));
    v_log := v_log || E'6. 숨긴 설문 응답: ❌ 됨\n';
  exception when others then
    v_log := v_log || '6. 숨긴 설문 응답: ' || sqlerrm || E'(survey_hidden)\n';
  end;

  -- 7. 작성자(단체)에게는 여전히 보임
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_log := v_log || format('7. 작성자에게 보이는 숨긴 설문 수: %s(1)',
    (select count(*) from public.surveys where id = v_survey)) || E'\n';
  reset role;

  -- 8. 신고 기록은 신고한 본인만 읽음 (단체에게는 0건)
  set local role authenticated;
  v_log := v_log || format('8. 작성자가 읽을 수 있는 신고 수: %s(0)',
    (select count(*) from public.reports where target_id = v_survey)) || E'\n';
  reset role;

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
