-- 친구 초대(20261030000025) 확인용 테스트 (2026-10-30)
-- 마이그레이션 적용 후 SQL Editor에서 Run. 마지막에 일부러 오류를 내서 바꾼 내용은 모두 취소된다.
-- 학생 테스터가 1명뿐이라, 블록 안에서만 가짜 신입 학생(친구)을 만든다 (함께 취소됨)

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_friend uuid := gen_random_uuid();
  v_code text;
  v_before integer;
  v_result jsonb;
  v_log text := E'\n';
begin
  -- 가짜 친구: 오늘 가입 + 웰컴 받음
  insert into auth.users (id, email, aud, role) values (v_friend, 'invite-test@cau.ac.kr', 'authenticated', 'authenticated');
  insert into public.profiles (id, account_type, approval_status, university_id, nickname)
  values (v_friend, 'student', 'approved', (select university_id from public.profiles where id = v_student), '초대테스트친구');
  insert into public.point_ledger (user_id, amount, status, reason) values (v_friend, 500, 'confirmed', 'welcome');

  -- 1. 내 초대 코드 (처음 열면 6자리 생성)
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  v_code := public.get_my_invite() ->> 'code';
  v_log := v_log || format('1. 내 코드 길이 %s(6) · 다시 열어도 같음 %s(true)',
    char_length(v_code), (public.get_my_invite() ->> 'code') = v_code) || E'\n';

  -- 2. 내 코드를 내가 입력 → 거절 (가입 7일이 지났으면 invite_expired가 먼저 나올 수 있음)
  begin
    perform public.redeem_invite(v_code);
    v_log := v_log || E'2. 내 코드 입력: ❌ 됨\n';
  exception when others then
    v_log := v_log || '2. 내 코드 입력: ' || sqlerrm || E'(invalid_invite 또는 invite_expired)\n';
  end;

  -- 3. 친구가 소문자로 입력 → 친구 +200, 나 +300
  select coalesce(sum(amount), 0)::integer into v_before from public.point_ledger where user_id = v_student and status = 'confirmed';
  perform set_config('request.jwt.claims', json_build_object('sub', v_friend, 'role', 'authenticated')::text, true);
  v_log := v_log || format('3. 친구 입력 가능: %s(true)', public.get_my_invite() ->> 'can_redeem') || E'\n';
  v_result := public.redeem_invite(lower(v_code));
  v_log := v_log || format('   친구 +%s(200) · 나 +%s(300)', v_result ->> 'reward',
    (select coalesce(sum(amount), 0)::integer from public.point_ledger where user_id = v_student and status = 'confirmed') - v_before) || E'\n';

  -- 4. 한 번 더 입력 → 거절
  begin
    perform public.redeem_invite(v_code);
    v_log := v_log || E'4. 두 번째 입력: ❌ 됨\n';
  exception when others then
    v_log := v_log || '4. 두 번째 입력: ' || sqlerrm || E'(invite_used)\n';
  end;

  -- 5. 틀린 코드 → 거절 (다른 가짜 친구가 아니라 같은 친구라 invite_used가 먼저일 수 있어 코드만 확인)
  v_log := v_log || format('5. 없는 코드 찾기: %s(0)',
    (select count(*) from public.profiles where invite_code = 'ZZZZZZ')) || E'\n';

  -- 6. 내 초대 인원
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  v_log := v_log || format('6. 내가 초대한 사람: %s(1)', public.get_my_invite() ->> 'invited') || E'\n';

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
