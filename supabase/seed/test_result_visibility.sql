-- 결과 공개 범위 확인용 테스트 (2026-10-30)
-- 20261030000006_result_visibility.sql 적용 후 SQL Editor에서 Run.
-- 마지막에 일부러 오류를 내서 테스트로 만든 데이터는 전부 취소된다 (DB에 남지 않음).
-- 결과는 빨간 오류 창의 "테스트 결과" 아래에 나온다.

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' and approval_status = 'approved' order by created_at limit 1);
  v_category bigint := (select id from public.survey_categories where key = 'life');
  v_one jsonb := '[{"type": "single", "text": "하나", "options": ["가", "나"]}]';
  v_default bigint;
  v_campus bigint;
  v_log text := E'\n';
begin
  insert into public.point_ledger (user_id, amount, status, reason, ref_id)
  values (v_student, 1000, 'confirmed', 'survey_reward', 'test-topup');
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);

  -- 1. 공개 범위를 안 보내면 전체 공개
  v_default := public.create_survey(gen_random_uuid(), v_category, '기본 공개', null, 'all', 10, 3, v_one);
  v_log := v_log || format('1. 기본값: %s(public)', (select result_visibility from public.surveys where id = v_default)) || E'\n';

  -- 2. 우리 학교만으로 등록 → 내 학교가 저장됨
  v_campus := public.create_survey(gen_random_uuid(), v_category, '학교 공개', null, 'all', 10, 3, v_one, 'campus');
  v_log := v_log || format('2. 우리 학교만: %s(campus) · 학교 저장 %s(true)',
    (select result_visibility from public.surveys where id = v_campus),
    (select result_university_id = (select university_id from public.profiles where id = v_student)
       from public.surveys where id = v_campus)) || E'\n';

  -- 3. 나중에 비공개로 바꾸기 → 학교 칸은 비워짐
  perform public.set_result_visibility(v_campus, 'private');
  v_log := v_log || format('3. 비공개로 변경: %s(private) · 학교 칸 %s(비어 있음)',
    (select result_visibility from public.surveys where id = v_campus),
    coalesce((select result_university_id::text from public.surveys where id = v_campus), '비어 있음')) || E'\n';

  -- 4. 잘못된 값 → invalid_visibility
  begin
    perform public.set_result_visibility(v_campus, 'everyone');
    v_log := v_log || E'4. 잘못된 값: ❌ 통과됨\n';
  exception when others then
    v_log := v_log || '4. 잘못된 값: ' || sqlerrm || E'(invalid_visibility)\n';
  end;

  -- 5. 남이 바꾸기 → not_owner
  if v_org is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
    begin
      perform public.set_result_visibility(v_campus, 'public');
      v_log := v_log || E'5. 남이 바꾸기: ❌ 통과됨\n';
    exception when others then
      v_log := v_log || '5. 남이 바꾸기: ' || sqlerrm || E'(not_owner)\n';
    end;
  end if;

  raise exception '테스트 결과 (만든 데이터는 모두 취소됨):%', v_log;
end;
$$;
