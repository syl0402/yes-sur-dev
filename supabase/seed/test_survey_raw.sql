-- 등록자 원본 CSV(get_survey_raw) 확인용 테스트 (2026-10-30)
-- 20261030000011_survey_raw.sql 적용 후 SQL Editor에서 Run.
-- 마지막에 일부러 오류를 내서 테스트로 바꾼 내용은 전부 취소된다 (DB에 남지 않음).

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
  v_survey bigint;
  v_answers jsonb;
  v_q record;
  v_first bigint;
  v_wrong bigint;
  v_correct boolean;
  v_result jsonb;
  v_log text := E'\n';
begin
  if v_student is null or v_org is null then
    raise exception '학생 테스터와 승인된 단체 테스터가 필요해요';
  end if;

  update public.profiles set gender = 'female', birth_year = extract(year from now())::integer - 22 where id = v_student;

  -- 단체가 설문 등록
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  v_survey := public.create_survey(gen_random_uuid(), v_category, '원본 CSV 테스트', null, 'all', 10, 3, v_five);

  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);

  -- 1. 등록자가 아니면 못 받음
  begin
    perform public.get_survey_raw(v_survey);
    v_log := v_log || E'1. 학생이 원본 받기: ❌ 됨\n';
  exception when others then
    v_log := v_log || '1. 학생이 원본 받기: ' || sqlerrm || E'(not_owner)\n';
  end;

  -- 학생이 두 번 응답: 처음엔 확인 문항 오답, 다시 응답할 때 정답
  foreach v_correct in array array[false, true] loop
    v_answers := '[]';
    for v_q in select id, type, is_attention_check, correct_option_id
                 from public.questions where survey_id = v_survey order by sort_order loop
      select id into v_first from public.question_options where question_id = v_q.id order by sort_order limit 1;
      select id into v_wrong from public.question_options
       where question_id = v_q.id and id is distinct from v_q.correct_option_id order by sort_order limit 1;
      v_answers := v_answers || case
        when v_q.is_attention_check then jsonb_build_array(jsonb_build_object('question_id', v_q.id,
          'option_ids', jsonb_build_array(case when v_correct then v_q.correct_option_id else v_wrong end)))
        when v_q.type = 'scale' then jsonb_build_array(jsonb_build_object('question_id', v_q.id, 'scale_value', 4))
        when v_q.type = 'text' then jsonb_build_array(jsonb_build_object('question_id', v_q.id, 'text_value', '비밀 답'))
        when v_q.type = 'multi' then jsonb_build_array(jsonb_build_object('question_id', v_q.id,
          'option_ids', (select jsonb_agg(id) from (select id from public.question_options
                          where question_id = v_q.id order by sort_order limit 2) t)))
        else jsonb_build_array(jsonb_build_object('question_id', v_q.id, 'option_ids', jsonb_build_array(v_first)))
      end;
    end loop;
    perform public.submit_response(v_survey, v_answers);

    -- 2. 오답 응답은 원본에서 빠짐
    if not v_correct then
      perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
      v_log := v_log || format('2. 오답만 있을 때 줄 수: %s(0)',
        jsonb_array_length(public.get_survey_raw(v_survey) -> 'rows')) || E'\n';
      perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
    end if;
  end loop;

  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);

  -- 3. 정답 응답: 1줄, 문항 5개(확인 문항 없음), 답 글자
  v_result := public.get_survey_raw(v_survey);
  v_log := v_log || format('3. 줄 %s(1) · 문항 %s(5) · 답 %s(["가", "가 | 나", "4", "비밀 답", "예"])',
    jsonb_array_length(v_result -> 'rows'), jsonb_array_length(v_result -> 'questions'),
    v_result #> '{rows,0,answers}') || E'\n';

  -- 4. 기준 5명: 1명뿐인 그룹 이름은 가려짐
  update public.point_rules set value = 5 where key = 'result_min_count';
  v_result := public.get_survey_raw(v_survey);
  v_log := v_log || format('4. 기준 5명일 때 성별 %s(5명 미만) · 계열 %s(5명 미만)',
    v_result #>> '{rows,0,gender}', v_result #>> '{rows,0,major}') || E'\n';

  -- 5. 기준 1명: 그룹 이름 그대로
  update public.point_rules set value = 1 where key = 'result_min_count';
  v_result := public.get_survey_raw(v_survey);
  v_log := v_log || format('5. 기준 1명일 때 성별 %s(여성) · 나이대 %s(21~23세)',
    v_result #>> '{rows,0,gender}', v_result #>> '{rows,0,age}') || E'\n';

  -- 6. 사용자 번호가 들어 있지 않음
  v_log := v_log || format('6. 사용자 번호 포함: %s(false)', v_result::text like '%' || v_student::text || '%') || E'\n';

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
