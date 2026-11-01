-- 교차 분석(20261101000003) 확인용 테스트 (2026-11-01)
-- 마이그레이션 적용 후 SQL Editor에서 Run. 마지막에 일부러 오류를 내서 바꾼 내용은 모두 취소된다.
-- 괄호 안이 기대값

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' and approval_status = 'approved' order by created_at limit 1);
  v_survey bigint;
  v_q1 bigint;   -- 기준: 공부 장소 (하나 고르기)
  v_q2 bigint;   -- 공부 시간 (하나 고르기)
  v_q3 bigint;   -- 여러 개 고르기 (기준 불가)
  v_q4 bigint;   -- 척도
  o1 bigint[];
  o2 bigint[];
  o3 bigint[];
  v_resp bigint;
  v_r jsonb;
  i integer;
  v_log text := E'\n';
begin
  if v_student is null or v_org is null then
    raise exception '학생 테스터와 승인된 단체 테스터가 필요해요';
  end if;
  update public.point_rules set value = 5 where key = 'result_min_count';

  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  v_survey := public.create_survey(gen_random_uuid(), (select id from public.survey_categories where key = 'study'),
    '교차 테스트', null, 'all', 30, 3, '[
      {"type": "single", "text": "공부 장소", "options": ["도서관", "카페", "집"]},
      {"type": "single", "text": "공부 시간", "options": ["짧게", "길게"]},
      {"type": "multi",  "text": "필요한 것", "options": ["콘센트", "조용함"]},
      {"type": "scale",  "text": "만족도"}
    ]');
  select array_agg(id order by sort_order) into o1 from public.questions where survey_id = v_survey and not is_attention_check;
  v_q1 := o1[1]; v_q2 := o1[2]; v_q3 := o1[3]; v_q4 := o1[4];
  o1 := array(select id from public.question_options where question_id = v_q1 order by sort_order);
  o2 := array(select id from public.question_options where question_id = v_q2 order by sort_order);
  o3 := array(select id from public.question_options where question_id = v_q3 order by sort_order);

  -- 응답 16개: 도서관 8명(전원 '길게'), 카페 5명(전원 '짧게'), 집 3명(→ 5명 미만이라 숨김)
  for i in 1 .. 16 loop
    insert into public.responses (survey_id, user_id, status) values (v_survey, null, 'confirmed') returning id into v_resp;
    insert into public.answers (response_id, question_id, option_ids)
    values (v_resp, v_q1, array[case when i <= 8 then o1[1] when i <= 13 then o1[2] else o1[3] end]),
           (v_resp, v_q2, array[case when i <= 8 then o2[2] else o2[1] end]),
           (v_resp, v_q3, array[o3[1]]);
    insert into public.answers (response_id, question_id, scale_value) values (v_resp, v_q4, case when i <= 8 then 5 else 2 end);
  end loop;
  update public.surveys set response_count = 16, status = 'closed' where id = v_survey;

  -- 1. 열람 안 한 학생은 거절
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  begin
    perform public.get_cross_results(v_survey, v_q1);
    v_log := v_log || E'1. 열람 전: ❌ 보임\n';
  exception when others then
    v_log := v_log || '1. 열람 전: ' || sqlerrm || E'(not_viewed)\n';
  end;

  -- 열람한 것으로
  insert into public.survey_views (survey_id, user_id, paid, free_reason) values (v_survey, v_student, 0, 'welcome');
  v_r := public.get_cross_results(v_survey, v_q1);

  -- 2. 묶음: 도서관 8 · 카페 5 · 집 숨김
  v_log := v_log || format('2. 묶음: %s(도서관 8, 카페 5, 집 숨김)',
    (select string_agg(e->>'label' || ' ' || coalesce(e->>'n', '숨김'), ', ') from jsonb_array_elements(v_r->'groups') e)) || E'\n';

  -- 3. 도서관파의 공부 시간: '길게' 8명 / 카페파: '짧게' 5명
  v_log := v_log || format('3. 도서관파 길게 %s(8) · 카페파 짧게 %s(5)',
    (select o->>'count' from jsonb_array_elements(v_r->'groups') e, jsonb_array_elements(e->'questions') q, jsonb_array_elements(q->'options') o
      where e->>'label' = '도서관' and (q->>'id')::bigint = v_q2 and o->>'text' = '길게'),
    (select o->>'count' from jsonb_array_elements(v_r->'groups') e, jsonb_array_elements(e->'questions') q, jsonb_array_elements(q->'options') o
      where e->>'label' = '카페' and (q->>'id')::bigint = v_q2 and o->>'text' = '짧게')) || E'\n';

  -- 4. 숨긴 묶음은 결과 없음
  v_log := v_log || format('4. 집 묶음 결과 개수: %s(0)',
    (select jsonb_array_length(e->'questions') from jsonb_array_elements(v_r->'groups') e where e->>'label' = '집')) || E'\n';

  -- 5. 척도 기준: 5점 8명 · 2점 8명
  v_r := public.get_cross_results(v_survey, v_q4);
  v_log := v_log || format('5. 척도 기준: %s(2점 8, 5점 8)',
    (select string_agg(e->>'label' || ' ' || coalesce(e->>'n', '숨김'), ', ') from jsonb_array_elements(v_r->'groups') e)) || E'\n';

  -- 6. 여러 개 고르기 기준은 거절
  begin
    perform public.get_cross_results(v_survey, v_q3);
    v_log := v_log || E'6. 여러 개 고르기 기준: ❌ 됨\n';
  exception when others then
    v_log := v_log || '6. 여러 개 고르기 기준: ' || sqlerrm || E'(invalid_cross)\n';
  end;

  -- 7. 다른 설문의 문항은 거절
  begin
    perform public.get_cross_results(v_survey, (select id from public.questions where survey_id <> v_survey limit 1));
    v_log := v_log || E'7. 다른 설문 문항: ❌ 됨\n';
  exception when others then
    v_log := v_log || '7. 다른 설문 문항: ' || sqlerrm || E'(invalid_cross)\n';
  end;

  -- 8. 등록자는 열람 없이 볼 수 있음
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  v_log := v_log || format('8. 등록자: 묶음 %s개(3)', jsonb_array_length(public.get_cross_results(v_survey, v_q1)->'groups')) || E'\n';

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
