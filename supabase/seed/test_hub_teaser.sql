-- 열람 전 인사이트 미리보기(20261101000004) 확인용 테스트 (2026-11-01)
-- 마이그레이션 적용 후 SQL Editor에서 Run. 마지막에 일부러 오류를 내서 바꾼 내용은 모두 취소된다.
-- 괄호 안이 기대값

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' and approval_status = 'approved' order by created_at limit 1);
  v_survey bigint;
  v_q1 bigint;
  v_q2 bigint;
  o1 bigint[];
  o2 bigint[];
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
  v_survey := public.create_survey(gen_random_uuid(), (select id from public.survey_categories where key = 'life'),
    '미리보기 테스트', null, 'all', 30, 3, '[
      {"type": "scale",  "text": "만족도"},
      {"type": "single", "text": "반반", "options": ["가", "나"]},
      {"type": "single", "text": "몰표", "options": ["찬성", "반대"]}
    ]');
  v_q2 := (select id from public.questions where survey_id = v_survey and text = '몰표');
  v_q1 := (select id from public.questions where survey_id = v_survey and text = '반반');
  o1 := array(select id from public.question_options where question_id = v_q1 order by sort_order);
  o2 := array(select id from public.question_options where question_id = v_q2 order by sort_order);

  -- 응답 10개: 반반 5:5, 몰표 9:1 (찬성 90%)
  for i in 1 .. 10 loop
    insert into public.responses (survey_id, user_id, status) values (v_survey, null, 'confirmed') returning id into v_resp;
    insert into public.answers (response_id, question_id, option_ids)
    values (v_resp, v_q1, array[case when i <= 5 then o1[1] else o1[2] end]),
           (v_resp, v_q2, array[case when i <= 9 then o2[1] else o2[2] end]);
  end loop;
  update public.surveys set response_count = 10 where id = v_survey;

  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);

  -- 1. 아직 진행 중이면 없음
  v_log := v_log || format('1. 진행 중: %s(null)', coalesce(public.get_hub_teaser(v_survey)::text, 'null')) || E'\n';

  -- 2. 마감하면 1위 비율이 가장 높은 문항
  update public.surveys set status = 'closed' where id = v_survey;
  v_r := public.get_hub_teaser(v_survey);
  v_log := v_log || format('2. 마감 후: %s번 %s · %s %s%%(3번 몰표 · 찬성 90%%)',
    v_r->>'index', v_r->>'question', v_r->>'option', v_r->>'pct') || E'\n';

  -- 3. 신고로 숨겨지면 없음
  update public.surveys set moderation = 'hidden' where id = v_survey;
  v_log := v_log || format('3. 숨김: %s(null)', coalesce(public.get_hub_teaser(v_survey)::text, 'null')) || E'\n';

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
