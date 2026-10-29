-- 데이터 허브 확인용 테스트 (2026-10-30)
-- 20261030000009_data_hub.sql 적용 후 SQL Editor에서 Run.
-- 마지막에 일부러 오류를 내서 테스트로 바꾼 내용은 전부 취소된다 (DB에 남지 않음).
-- 테스터가 학생 1명뿐이라, 블록 안에서만 "최소 응답 5개" 기준을 1로 낮춰서 확인한다.

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
  v_s1 bigint;
  v_s2 bigint;
  v_s3 bigint;
  v_survey bigint;
  v_answers jsonb;
  v_q record;
  v_first bigint;
  v_result jsonb;
  v_before integer;
  v_org_before integer;
  v_log text := E'\n';
begin
  if v_student is null or v_org is null then
    raise exception '학생 테스터와 승인된 단체 테스터가 필요해요';
  end if;

  -- 준비: 기준 낮추기, 학생 포인트, 학생 성별·출생연도 (모두 블록 끝에서 취소됨)
  update public.point_rules set value = 1 where key = 'result_min_count';
  update public.point_rules set value = 1 where key = 'trust_min_responses';
  update public.profiles set gender = 'female', birth_year = extract(year from now())::integer - 22 where id = v_student;
  insert into public.point_ledger (user_id, amount, status, reason, ref_id)
  values (v_student, 1000, 'confirmed', 'survey_reward', 'test-topup');

  -- 단체가 설문 3개 등록 (3번은 비공개)
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  v_s1 := public.create_survey(gen_random_uuid(), v_category, '허브 테스트 1', null, 'all', 10, 3, v_five);
  v_s2 := public.create_survey(gen_random_uuid(), v_category, '허브 테스트 2', null, 'all', 10, 3, v_five);
  v_s3 := public.create_survey(gen_random_uuid(), v_category, '허브 테스트 3', null, 'all', 10, 3, v_five, 'private');

  -- 학생이 세 설문에 응답 (확인 문항은 정답)
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  foreach v_survey in array array[v_s1, v_s2, v_s3] loop
    v_answers := '[]';
    for v_q in select id, type, is_attention_check, correct_option_id
                 from public.questions where survey_id = v_survey order by sort_order loop
      select id into v_first from public.question_options where question_id = v_q.id order by sort_order limit 1;
      v_answers := v_answers || case
        when v_q.is_attention_check then jsonb_build_array(jsonb_build_object('question_id', v_q.id, 'option_ids', jsonb_build_array(v_q.correct_option_id)))
        when v_q.type = 'scale' then jsonb_build_array(jsonb_build_object('question_id', v_q.id, 'scale_value', 4))
        when v_q.type = 'text' then jsonb_build_array(jsonb_build_object('question_id', v_q.id, 'text_value', '비밀 답'))
        else jsonb_build_array(jsonb_build_object('question_id', v_q.id, 'option_ids', jsonb_build_array(v_first)))
      end;
    end loop;
    perform public.submit_response(v_survey, v_answers);
  end loop;

  -- 1. 마감 전에는 허브에 없음
  v_log := v_log || format('1. 마감 전 목록에 있음: %s(false)',
    public.get_hub_list() @> jsonb_build_array(jsonb_build_object('id', v_s1))) || E'\n';

  -- 단체가 세 설문 마감
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  perform public.close_survey(v_s1);
  perform public.close_survey(v_s2);
  perform public.close_survey(v_s3);

  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);

  -- 2. 마감 후 목록: 1·2번은 보이고, 비공개 3번은 안 보임
  v_result := public.get_hub_list();
  v_log := v_log || format('2. 목록: 1번 %s(true) · 비공개 3번 %s(false)',
    v_result @> jsonb_build_array(jsonb_build_object('id', v_s1)),
    v_result @> jsonb_build_array(jsonb_build_object('id', v_s3))) || E'\n';

  -- 3. 무료 정보: 문항 목록에 확인 문항 없음, 응답자 구성에 성별, 첫 열람 무료 표시
  v_result := public.get_hub_preview(v_s1);
  v_log := v_log || format('3. 미리보기: 문항 %s개(5) · 성별 구성 %s(여성) · 무료 이유 %s(welcome)',
    jsonb_array_length(v_result -> 'questions'),
    v_result #>> '{composition,gender,0,label}', v_result ->> 'free_reason') || E'\n';

  -- 4. 내 답 비교 (주관식 빼고 4문항, 나 혼자라 100%)
  v_result := public.get_my_comparison(v_s1);
  v_log := v_log || format('4. 내 답 비교: %s문항(4) · 첫 문항 내 답 %s(가) %s%%(100)',
    jsonb_array_length(v_result), v_result #>> '{0,mine,0}', v_result #>> '{0,same_pct,0}') || E'\n';

  -- 5. 열람 전에는 전체 결과 못 봄
  begin
    perform public.get_full_results(v_s1);
    v_log := v_log || E'5. 열람 전 전체 결과: ❌ 보임\n';
  exception when others then
    v_log := v_log || '5. 열람 전 전체 결과: ' || sqlerrm || E'(not_viewed)\n';
  end;

  -- 6. 첫 열람은 무료, 두 번 눌러도 그대로
  v_before := public.get_my_balance();
  v_result := public.view_survey(v_s1);
  v_log := v_log || format('6. 첫 열람: %s(welcome) · 낸 포인트 %s(0) · 다시 누르면 %s(already)',
    v_result ->> 'free_reason', v_result ->> 'paid', public.view_survey(v_s1) ->> 'free_reason') || E'\n';

  -- 7. 두 번째 설문은 100P, 단체(등록자)에게 40P
  select coalesce(sum(amount), 0)::integer into v_org_before from public.point_ledger where user_id = v_org and status = 'confirmed';
  v_result := public.view_survey(v_s2);
  v_log := v_log || format('7. 두 번째 열람: %s(paid) · 내 포인트 변화 %s(-100) · 등록자 받음 %s(40)',
    v_result ->> 'free_reason', public.get_my_balance() - v_before,
    (select coalesce(sum(amount), 0)::integer from public.point_ledger where user_id = v_org and status = 'confirmed') - v_org_before) || E'\n';

  -- 8. 전체 결과: 유효 1 · 척도 평균 4 · 성별 그룹 있음 · 주관식 답 원문 없음
  v_result := public.get_full_results(v_s2);
  v_log := v_log || format('8. 전체 결과: 유효 %s(1) · 척도 평균 %s(4.0) · 성별 그룹 %s(여성) · 주관식 원문 포함 %s(false)',
    v_result ->> 'total', v_result #>> '{overall,2,scale,avg}',
    v_result #>> '{groups,gender,0,label}', v_result::text like '%비밀 답%') || E'\n';

  -- 9. 비공개 설문: 응답자도 미리보기·내 답 비교 못 함
  begin
    perform public.get_my_comparison(v_s3);
    v_log := v_log || E'9. 비공개 내 답 비교: ❌ 보임\n';
  exception when others then
    v_log := v_log || '9. 비공개 내 답 비교: ' || sqlerrm || E'(not_listed)\n';
  end;

  -- 10. 비공개 설문 열람 시도 → not_listed, 포인트 그대로
  v_before := public.get_my_balance();
  begin
    perform public.view_survey(v_s3);
    v_log := v_log || E'10. 비공개 열람: ❌ 됨\n';
  exception when others then
    v_log := v_log || format('10. 비공개 열람: %s(not_listed) · 포인트 변화 %s(0)', sqlerrm, public.get_my_balance() - v_before) || E'\n';
  end;

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
