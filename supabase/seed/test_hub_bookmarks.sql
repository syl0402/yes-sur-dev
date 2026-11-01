-- 결과 저장(20261101000005) 확인용 테스트 (2026-11-01)
-- 마이그레이션 적용 후 SQL Editor에서 Run. 마지막에 일부러 오류를 내서 바꾼 내용은 모두 취소된다.
-- 괄호 안이 기대값

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' and approval_status = 'approved' order by created_at limit 1);
  v_open bigint;
  v_closed bigint;
  v_log text := E'\n';
begin
  if v_student is null or v_org is null then
    raise exception '학생 테스터와 승인된 단체 테스터가 필요해요';
  end if;
  update public.point_rules set value = 1 where key = 'result_min_count';

  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  v_open := public.create_survey(gen_random_uuid(), (select id from public.survey_categories where key = 'life'),
    '저장 테스트 진행 중', null, 'all', 10, 3, '[{"type": "single", "text": "하나", "options": ["가", "나"]}]');
  v_closed := public.create_survey(gen_random_uuid(), (select id from public.survey_categories where key = 'life'),
    '저장 테스트 마감', null, 'all', 10, 3, '[{"type": "single", "text": "하나", "options": ["가", "나"]}]');
  update public.surveys set status = 'closed', response_count = 3 where id = v_closed;

  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);

  -- 1. 데이터 탭에 없는 설문(진행 중)은 저장 못 함
  begin
    perform public.toggle_bookmark(v_open);
    v_log := v_log || E'1. 진행 중 설문 저장: ❌ 됨\n';
  exception when others then
    v_log := v_log || '1. 진행 중 설문 저장: ' || sqlerrm || E'(not_listed)\n';
  end;

  -- 2. 저장 → 목록에 있음 (저장과 목록 확인은 따로: 한 문장 안에서는 바뀐 내용이 아직 안 보임)
  v_log := v_log || format('2. 저장: %s(true)', public.toggle_bookmark(v_closed));
  v_log := v_log || format(' · 내 목록에 있음 %s(true)', v_closed = any (public.get_my_bookmarks())) || E'\n';

  -- 3. 다시 누르면 해제
  v_log := v_log || format('3. 해제: %s(false)', public.toggle_bookmark(v_closed));
  v_log := v_log || format(' · 목록에 있음 %s(false)', v_closed = any (public.get_my_bookmarks())) || E'\n';

  -- 4. 다시 저장 후 줄 수 1개
  perform public.toggle_bookmark(v_closed);
  v_log := v_log || format('4. 저장 기록: %s줄(1)',
    (select count(*) from public.hub_bookmarks where user_id = v_student and survey_id = v_closed)) || E'\n';

  -- 5. 다른 사람은 내 저장 목록을 못 봄
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  v_log := v_log || format('5. 단체 계정의 저장 목록에 학생 저장분: %s(false)', v_closed = any (public.get_my_bookmarks())) || E'\n';

  -- 6. 앱은 표를 직접 못 읽음
  begin
    set local role authenticated;
    perform count(*) from public.hub_bookmarks;
    reset role;
    v_log := v_log || E'6. 표 직접 읽기: ❌ 됨\n';
  exception when others then
    reset role;
    v_log := v_log || '6. 표 직접 읽기: ' || sqlerrm || E'(권한 없음 = 정상)\n';
  end;

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
