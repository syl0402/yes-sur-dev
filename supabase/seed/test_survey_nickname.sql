-- 개인 설문 닉네임 공개(20261102000002) 확인용 테스트 (2026-11-02)
-- 마이그레이션 적용 후 SQL Editor에서 Run. 마지막에 일부러 오류를 내서 바꾼 내용은 모두 취소된다.
-- 괄호 안이 기대값

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' and approval_status = 'approved' order by created_at limit 1);
  v_mine bigint;
  v_org_survey bigint;
  v_nick text;
  v_log text := E'\n';
begin
  if v_student is null or v_org is null then
    raise exception '학생 테스터와 승인된 단체 테스터가 필요해요';
  end if;
  v_nick := (select nickname from public.profiles where id = v_student);

  -- 준비: 학생 설문 1개 (등록비가 모자라지 않게 포인트를 넣어 둠), 단체 설문 1개
  insert into public.point_ledger (user_id, amount, status, reason, ref_id)
  values (v_student, 5000, 'confirmed', 'survey_reward', 'dev-nickname-test');
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  v_mine := public.create_survey(gen_random_uuid(), (select id from public.survey_categories where key = 'life'),
    '닉네임 테스트', null, 'all', 10, 3, '[{"type": "single", "text": "하나", "options": ["가", "나"]}]');
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  v_org_survey := public.create_survey(gen_random_uuid(), (select id from public.survey_categories where key = 'life'),
    '단체 테스트', null, 'all', 10, 3, '[{"type": "single", "text": "하나", "options": ["가", "나"]}]');

  -- 1. 처음엔 비공개 (작성자 이름 없음 → 앱에서 "옛썰러")
  v_log := v_log || format('1. 기본: 작성자 %s(null) · 공개 %s(false)',
    coalesce((select host_name from public.surveys where id = v_mine), 'null'),
    (select show_nickname from public.surveys where id = v_mine)) || E'\n';

  -- 2. 단체는 이 기능을 못 씀
  begin
    perform public.set_survey_show_nickname(v_org_survey, true);
    v_log := v_log || E'2. 단체가 사용: ❌ 됨\n';
  exception when others then
    v_log := v_log || '2. 단체가 사용: ' || sqlerrm || E'(nickname_student_only)\n';
  end;

  -- 3. 학생이 내 설문 공개 → 닉네임, 인증 표시는 그대로 false
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  perform public.set_survey_show_nickname(v_mine, true);
  v_log := v_log || format('3. 공개: 작성자 %s(%s) · 인증 %s(false)',
    (select host_name from public.surveys where id = v_mine), v_nick,
    (select host_verified from public.surveys where id = v_mine)) || E'\n';

  -- 4. 남의(단체) 설문은 못 바꿈
  begin
    perform public.set_survey_show_nickname(v_org_survey, true);
    v_log := v_log || E'4. 남의 설문: ❌ 바뀜\n';
  exception when others then
    v_log := v_log || '4. 남의 설문: ' || sqlerrm || E'(survey_not_found)\n';
  end;

  -- 5. 닉네임을 바꾸면 공개한 설문 이름도 바뀜
  update public.profiles set nickname = '바뀐닉네임' where id = v_student;
  v_log := v_log || format('5. 닉네임 변경 후: %s(바뀐닉네임)', (select host_name from public.surveys where id = v_mine)) || E'\n';

  -- 6. 다시 비공개
  perform public.set_survey_show_nickname(v_mine, false);
  v_log := v_log || format('6. 비공개: 작성자 %s(null)',
    coalesce((select host_name from public.surveys where id = v_mine), 'null')) || E'\n';

  -- 6-1. 다시 공개한 뒤 작성자가 탈퇴하면(owner_id → null) 닉네임도 지워짐
  perform public.set_survey_show_nickname(v_mine, true);
  update public.surveys set owner_id = null where id = v_mine;
  v_log := v_log || format('6-1. 탈퇴 후: 작성자 %s(null) · 공개 %s(false)',
    coalesce((select host_name from public.surveys where id = v_mine), 'null'),
    (select show_nickname from public.surveys where id = v_mine)) || E'\n';

  -- 7. 단체 설문 이름은 그대로
  v_log := v_log || format('7. 단체 설문: 작성자 %s · 인증 %s(true)',
    (select host_name from public.surveys where id = v_org_survey),
    (select host_verified from public.surveys where id = v_org_survey)) || E'\n';

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
