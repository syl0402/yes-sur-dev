-- 결과 보기·응답 마감 확인용 테스트 (2026-10-30)
-- 20261030000004_survey_results.sql 적용 후 SQL Editor에서 Run.
-- 마지막에 일부러 오류를 내서 테스트로 만든 데이터는 전부 취소된다 (DB에 남지 않음).
-- 결과는 빨간 오류 창의 "테스트 결과" 아래에 나온다.
-- 필요한 것: 학생 테스터 1명, 승인된 단체 테스터 1명

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' and approval_status = 'approved' order by created_at limit 1);
  v_survey bigint;
  v_q record;
  v_first bigint;
  v_wrong bigint;
  v_answers jsonb := '[]';
  v_fake bigint;
  v_result jsonb;
  v_log text := E'\n';
begin
  if v_student is null or v_org is null then
    raise exception '학생 테스터와 승인된 단체 테스터가 필요해요';
  end if;

  -- 단체가 5문항 설문 등록 (확인 문항 1개 자동 추가)
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  v_survey := public.create_survey(gen_random_uuid(),
    (select id from public.survey_categories where key = 'life'), '결과 테스트', null, 'all', 10, 3,
    '[
      {"type": "single", "text": "하나", "options": ["가", "나"]},
      {"type": "multi",  "text": "여럿", "options": ["가", "나", "다"]},
      {"type": "scale",  "text": "척도"},
      {"type": "text",   "text": "주관식"},
      {"type": "single", "text": "하나 더", "options": ["예", "아니요"]}
    ]');

  -- 학생 응답 (확인 문항 정답): 하나=첫 보기, 여럿=가·나, 척도 4, 주관식 "좋아요", 하나 더=첫 보기
  for v_q in select id, type, is_attention_check, correct_option_id
               from public.questions where survey_id = v_survey order by sort_order loop
    select id into v_first from public.question_options where question_id = v_q.id order by sort_order limit 1;
    v_answers := v_answers || case
      when v_q.is_attention_check then
        jsonb_build_array(jsonb_build_object('question_id', v_q.id, 'option_ids', jsonb_build_array(v_q.correct_option_id)))
      when v_q.type = 'single' then
        jsonb_build_array(jsonb_build_object('question_id', v_q.id, 'option_ids', jsonb_build_array(v_first)))
      when v_q.type = 'multi' then
        jsonb_build_array(jsonb_build_object('question_id', v_q.id, 'option_ids',
          (select jsonb_agg(id) from (select id from public.question_options where question_id = v_q.id order by sort_order limit 2) o)))
      when v_q.type = 'scale' then
        jsonb_build_array(jsonb_build_object('question_id', v_q.id, 'scale_value', 4))
      else
        jsonb_build_array(jsonb_build_object('question_id', v_q.id, 'text_value', '좋아요'))
    end;
  end loop;

  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  perform public.submit_response(v_survey, v_answers);

  -- 확인 문항을 틀린 가짜 응답 1개 (테스트용으로 직접 넣음. 블록 끝에서 취소됨)
  insert into public.responses (survey_id, user_id) values (v_survey, v_org) returning id into v_fake;
  for v_q in select id, type, is_attention_check, correct_option_id
               from public.questions where survey_id = v_survey order by sort_order loop
    if v_q.is_attention_check then
      select id into v_wrong from public.question_options
       where question_id = v_q.id and id <> v_q.correct_option_id limit 1;
      insert into public.answers (response_id, question_id, option_ids) values (v_fake, v_q.id, array[v_wrong]);
    elsif v_q.type = 'scale' then
      insert into public.answers (response_id, question_id, scale_value) values (v_fake, v_q.id, 1);
    elsif v_q.type = 'text' then
      insert into public.answers (response_id, question_id, text_value) values (v_fake, v_q.id, '대충');
    else
      insert into public.answers (response_id, question_id, option_ids)
      select v_fake, v_q.id, array[(select id from public.question_options where question_id = v_q.id order by sort_order desc limit 1)];
    end if;
  end loop;

  -- 1. 작성자(단체)가 결과 보기
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  v_result := public.get_survey_results(v_survey);
  v_log := v_log || format('1. 결과: 유효 %s(1) · 뺀 응답 %s(1) · 문항 %s개(5, 확인 문항 제외)',
    v_result ->> 'total', v_result ->> 'excluded', jsonb_array_length(v_result -> 'questions')) || E'\n';
  v_log := v_log || format('2. 하나 고르기 첫 보기 %s명(1) · 둘째 보기 %s명(0)',
    v_result #>> '{questions,0,options,0,count}', v_result #>> '{questions,0,options,1,count}') || E'\n';
  v_log := v_log || format('3. 여럿: 가 %s · 나 %s · 다 %s (1·1·0)',
    v_result #>> '{questions,1,options,0,count}', v_result #>> '{questions,1,options,1,count}',
    v_result #>> '{questions,1,options,2,count}') || E'\n';
  v_log := v_log || format('4. 척도 평균 %s(4.0) · 4점 %s명(1) · 1점 %s명(0)',
    v_result #>> '{questions,2,scale,avg}', v_result #>> '{questions,2,scale,counts,3}',
    v_result #>> '{questions,2,scale,counts,0}') || E'\n';
  v_log := v_log || format('5. 주관식 %s(["좋아요"])', v_result #> '{questions,3,texts}') || E'\n';

  -- 6~7. 작성자가 아니면 결과·마감 거절
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  begin
    perform public.get_survey_results(v_survey);
    v_log := v_log || E'6. 남이 결과 보기: ❌ 통과됨\n';
  exception when others then
    v_log := v_log || '6. 남이 결과 보기: ' || sqlerrm || E'(not_owner)\n';
  end;
  begin
    perform public.close_survey(v_survey);
    v_log := v_log || E'7. 남이 마감: ❌ 통과됨\n';
  exception when others then
    v_log := v_log || '7. 남이 마감: ' || sqlerrm || E'(not_owner)\n';
  end;

  -- 8. 작성자가 마감 → 상태 closed, 이후 응답은 survey_closed
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  perform public.close_survey(v_survey);
  v_log := v_log || format('8. 마감 후 상태: %s(closed)', (select status from public.surveys where id = v_survey)) || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  begin
    perform public.submit_response(v_survey, v_answers);
    v_log := v_log || E'9. 마감 후 응답: ❌ 통과됨\n';
  exception when others then
    v_log := v_log || '9. 마감 후 응답: ' || sqlerrm || E'(survey_closed)\n';
  end;

  raise exception '테스트 결과 (만든 데이터는 모두 취소됨):%', v_log;
end;
$$;
