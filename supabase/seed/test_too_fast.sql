-- 너무 빠른 응답(20261031000001) 확인용 테스트 (2026-10-31)
-- 마이그레이션 적용 후 SQL Editor에서 Run. 마지막에 일부러 오류를 내서 바꾼 내용은 모두 취소된다.

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' and approval_status = 'approved' order by created_at limit 1);
  v_category bigint := (select id from public.survey_categories where key = 'life');
  v_three jsonb := '[
    {"type": "single", "text": "하나", "options": ["가", "나"]},
    {"type": "single", "text": "둘", "options": ["가", "나"]},
    {"type": "scale",  "text": "셋"}
  ]';
  v_survey bigint;
  v_answers jsonb := '[]';
  v_q record;
  v_result jsonb;
  v_before integer;
  v_log text := E'\n';
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  v_survey := public.create_survey(gen_random_uuid(), v_category, '빠른 응답 테스트', null, 'all', 10, 3, v_three);

  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  for v_q in select id, type from public.questions where survey_id = v_survey order by sort_order loop
    v_answers := v_answers || case
      when v_q.type = 'scale' then jsonb_build_array(jsonb_build_object('question_id', v_q.id, 'scale_value', 3))
      else jsonb_build_array(jsonb_build_object('question_id', v_q.id,
        'option_ids', jsonb_build_array((select id from public.question_options where question_id = v_q.id order by sort_order limit 1))))
    end;
  end loop;

  -- 1. 3문항을 5초에 (기준 3 × 2 = 6초) → 반려, 포인트 없음
  v_before := public.get_my_balance();
  v_result := public.submit_response(v_survey, v_answers, 5);
  v_log := v_log || format('1. 5초 응답: 통과 %s(false) · 이유 %s(too_fast) · 포인트 변화 %s(0) · 응답 수 %s(0)',
    v_result ->> 'passed', v_result ->> 'reason', public.get_my_balance() - v_before,
    (select response_count from public.surveys where id = v_survey)) || E'\n';

  -- 2. 다시 응답, 30초 → 통과, 보상
  v_result := public.submit_response(v_survey, v_answers, 30);
  v_log := v_log || format('2. 30초 다시 응답: 통과 %s(true) · 포인트 변화 %s(보상만큼) · 응답 수 %s(1)',
    v_result ->> 'passed', public.get_my_balance() - v_before,
    (select response_count from public.surveys where id = v_survey)) || E'\n';

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
