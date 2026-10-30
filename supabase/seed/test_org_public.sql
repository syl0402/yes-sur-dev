-- 단체 결과 공개 조건(20261030000013) 확인용 테스트 (2026-10-30)
-- 마이그레이션 적용 후 SQL Editor에서 Run.
-- 마지막에 일부러 오류를 내서 테스트로 바꾼 내용은 전부 취소된다 (DB에 남지 않음).

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' and approval_status = 'approved' order by created_at limit 1);
  v_category bigint := (select id from public.survey_categories where key = 'life');
  v_one jsonb := '[{"type": "single", "text": "하나", "options": ["가", "나"]}]';
  v_survey bigint;
  v_log text := E'\n';
begin
  if v_student is null or v_org is null then
    raise exception '학생 테스터와 승인된 단체 테스터가 필요해요';
  end if;
  insert into public.point_ledger (user_id, amount, status, reason, ref_id)
  values (v_student, 1000, 'confirmed', 'survey_reward', 'test-topup');

  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);

  -- 1. 단체가 나만 보기로 등록 → 거절
  begin
    perform public.create_survey(gen_random_uuid(), v_category, '단체 비공개', null, 'all', 10, 3, v_one, 'private');
    v_log := v_log || E'1. 단체 나만 보기 등록: ❌ 됨\n';
  exception when others then
    v_log := v_log || '1. 단체 나만 보기 등록: ' || sqlerrm || E'(org_must_publish)\n';
  end;

  -- 2. 단체가 전체 공개로 등록 → 성공
  v_survey := public.create_survey(gen_random_uuid(), v_category, '단체 공개', null, 'all', 10, 3, v_one, 'public');
  v_log := v_log || format('2. 단체 전체 공개 등록: %s(true)', v_survey is not null) || E'\n';

  -- 3. 등록 후 나만 보기로 바꾸기 → 거절
  begin
    perform public.set_result_visibility(v_survey, 'private');
    v_log := v_log || E'3. 단체 나만 보기로 변경: ❌ 됨\n';
  exception when others then
    v_log := v_log || '3. 단체 나만 보기로 변경: ' || sqlerrm || E'(org_must_publish)\n';
  end;

  -- 4. 학생은 나만 보기 가능
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  v_survey := public.create_survey(gen_random_uuid(), v_category, '학생 비공개', null, 'all', 10, 3, v_one, 'private');
  v_log := v_log || format('4. 학생 나만 보기 등록: %s(private)',
    (select result_visibility from public.surveys where id = v_survey)) || E'\n';

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
