-- 의견 보내기(20261030000017) 확인용 테스트 (2026-10-30)
-- 마이그레이션 적용 후 SQL Editor에서 Run. 마지막에 일부러 오류를 내서 바꾼 내용은 모두 취소된다.

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' order by created_at limit 1);
  v_id bigint;
  v_log text := E'\n';
begin
  update public.point_rules set value = 2 where key = 'feedback_daily_max';
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);

  -- 1. 보내기
  v_id := public.send_feedback('bug', '  응답 화면이 멈춰요  ', '마이 탭', '{"os": "android", "osVersion": "14", "appVersion": "1.0.0"}');
  v_log := v_log || format('1. 저장: 내용 "%s"(앞뒤 공백 없음) · 기기 %s(android)',
    (select body from public.feedback where id = v_id), (select device ->> 'os' from public.feedback where id = v_id)) || E'\n';

  -- 2. 빈 내용 거절
  begin
    perform public.send_feedback('idea', '   ');
    v_log := v_log || E'2. 빈 내용: ❌ 됨\n';
  exception when others then
    v_log := v_log || '2. 빈 내용: ' || sqlerrm || E'(invalid_feedback)\n';
  end;

  -- 3. 하루 건수 (테스트에서 2건으로 낮춤) → 2건째 성공, 3건째 거절
  perform public.send_feedback('idea', '두 번째');
  begin
    perform public.send_feedback('idea', '세 번째');
    v_log := v_log || E'3. 하루 3건째: ❌ 됨\n';
  exception when others then
    v_log := v_log || '3. 하루 3건째: ' || sqlerrm || E'(feedback_limit)\n';
  end;

  -- 4. 남의 의견은 못 읽음 (단체 계정으로 읽기)
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_log := v_log || format('4. 남이 읽을 수 있는 내 의견: %s(0)',
    (select count(*) from public.feedback where user_id = v_student)) || E'\n';
  reset role;

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
