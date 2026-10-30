-- 회원 탈퇴(20261030000015) 확인용 테스트 (2026-10-30)
-- 마이그레이션 적용 후 SQL Editor에서 Run.
-- 블록 안에서 단체·학생 테스터를 실제로 탈퇴시켜 보지만, 마지막에 일부러 오류를 내서
-- 전부 취소된다 (계정·데이터 모두 그대로 남음).

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' and approval_status = 'approved' order by created_at limit 1);
  v_category bigint := (select id from public.survey_categories where key = 'life');
  v_one jsonb := '[{"type": "single", "text": "하나", "options": ["가", "나"]}]';
  v_public bigint;   -- 단체 설문 (학생이 응답 → 마감 → 단체 탈퇴)
  v_open bigint;     -- 단체 설문 (진행 중에 단체 탈퇴)
  v_private bigint;  -- 학생의 나만 보기 설문
  v_q bigint;
  v_o bigint;
  v_welcome_before integer;
  v_log text := E'\n';
begin
  if v_student is null or v_org is null then
    raise exception '학생 테스터와 승인된 단체 테스터가 필요해요';
  end if;
  update public.point_rules set value = 1 where key = 'result_min_count';
  update public.profiles set gender = 'female', birth_year = extract(year from now())::integer - 22 where id = v_student;
  insert into public.point_ledger (user_id, amount, status, reason, ref_id)
  values (v_student, 1000, 'confirmed', 'survey_reward', 'test-topup');

  -- 1. 웰컴은 한 번만: 같은 학생에게 웰컴을 또 넣으면 건너뜀
  select count(*) into v_welcome_before from public.point_ledger where user_id = v_student and reason = 'welcome';
  insert into public.point_ledger (user_id, amount, status, reason, ref_id)
  values (v_student, 500, 'confirmed', 'welcome', null);
  v_log := v_log || format('1. 웰컴 다시 넣기: 기록 %s개 → %s개(그대로)',
    v_welcome_before, (select count(*) from public.point_ledger where user_id = v_student and reason = 'welcome')) || E'\n';

  -- 준비: 단체 설문 2개, 학생은 1번에 응답, 학생 나만 보기 설문 1개
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  v_public := public.create_survey(gen_random_uuid(), v_category, '탈퇴 테스트 공개', null, 'all', 10, 3, v_one);
  v_open := public.create_survey(gen_random_uuid(), v_category, '탈퇴 테스트 진행 중', null, 'all', 10, 3, v_one);

  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  select id into v_q from public.questions where survey_id = v_public order by sort_order limit 1;
  select id into v_o from public.question_options where question_id = v_q order by sort_order limit 1;
  perform public.submit_response(v_public, jsonb_build_array(jsonb_build_object('question_id', v_q, 'option_ids', jsonb_build_array(v_o))));
  v_private := public.create_survey(gen_random_uuid(), v_category, '탈퇴 테스트 비공개', null, 'all', 10, 3, v_one, 'private');

  -- 2. 응답에 그룹이 저장됨
  v_log := v_log || format('2. 응답에 저장된 성별: %s(여성)',
    (select grp_gender from public.responses where survey_id = v_public and user_id = v_student)) || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  perform public.close_survey(v_public);

  -- ── 단체 탈퇴 ──
  perform public.delete_my_account();
  v_log := v_log || format('3. 단체 탈퇴: 회원정보 %s(0) · 공개 설문 남음 %s(true) · 등록자 %s(null) · 진행 중 설문 %s(closed)',
    (select count(*) from public.profiles where id = v_org),
    exists (select 1 from public.surveys where id = v_public),
    coalesce((select owner_id::text from public.surveys where id = v_public), 'null'),
    (select status from public.surveys where id = v_open)) || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);

  -- 4. 탈퇴한 등록자의 결과도 허브에 남음
  v_log := v_log || format('4. 허브 목록에 있음: %s(true)',
    public.get_hub_list() @> jsonb_build_array(jsonb_build_object('id', v_public))) || E'\n';

  -- 5. 열람 전에는 전체 결과를 못 봄 (등록자가 비어도 구멍 없음)
  begin
    perform public.get_full_results(v_public);
    v_log := v_log || E'5. 열람 전 전체 결과: ❌ 보임\n';
  exception when others then
    v_log := v_log || '5. 열람 전 전체 결과: ' || sqlerrm || E'(not_viewed)\n';
  end;

  -- 6. 열람은 오류 없이 (1문항이라 무료, 등록자 몫 없음)
  v_log := v_log || format('6. 열람: %s(one_question)',
    public.view_survey(v_public) ->> 'free_reason') || E'\n';

  -- ── 학생 탈퇴 ──
  perform public.delete_my_account();
  v_log := v_log || format('7. 학생 탈퇴: 회원정보 %s(0) · 포인트 기록 %s(0) · 나만 보기 설문 %s(0)',
    (select count(*) from public.profiles where id = v_student),
    (select count(*) from public.point_ledger where user_id = v_student),
    (select count(*) from public.surveys where id = v_private)) || E'\n';

  -- 8. 응답은 익명으로 남고 그룹도 유지
  v_log := v_log || format('8. 남은 응답 %s(1) · 응답자 %s(null) · 성별 %s(여성) · 응답 수 %s(1)',
    (select count(*) from public.responses where survey_id = v_public),
    coalesce((select user_id::text from public.responses where survey_id = v_public), 'null'),
    (select grp_gender from public.responses where survey_id = v_public),
    (select response_count from public.surveys where id = v_public)) || E'\n';

  -- 9. 열람 기록도 남음 (열람 수 유지)
  v_log := v_log || format('9. 열람 기록 %s(1)',
    (select count(*) from public.survey_views where survey_id = v_public)) || E'\n';

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨, 계정도 그대로):%', v_log;
end;
$$;
