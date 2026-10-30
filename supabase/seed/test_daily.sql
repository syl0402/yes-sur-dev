-- 오늘의 질문 + 출석(20261030000018) 확인용 테스트 (2026-10-30)
-- 마이그레이션 적용 후 SQL Editor에서 Run. 마지막에 일부러 오류를 내서 바꾼 내용은 모두 취소된다.

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' order by created_at limit 1);
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_d integer;
  v_qid bigint;
  v_result jsonb;
  v_before integer;
  v_log text := E'\n';
begin
  -- 준비: 지난 6일 + 오늘 질문 (기존 예약은 블록 안에서만 지움), 학생은 지난 6일 모두 답한 상태로
  delete from public.daily_questions where day between v_today - 6 and v_today;
  for v_d in 0..6 loop
    insert into public.daily_questions (day, question, option_a, option_b)
    values (v_today - v_d, '테스트 질문 ' || v_d, '예', '아니요') returning id into v_qid;
    if v_d > 0 then
      insert into public.daily_answers (question_id, user_id, choice) values (v_qid, v_student, 'a');
    end if;
  end loop;

  -- 1. 답하기 전: 비율은 숨김, 연속은 어제까지 6일
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  v_result := public.get_today_daily();
  v_log := v_log || format('1. 답하기 전: A 비율 %s(null) · 연속 %s(6)',
    coalesce(v_result ->> 'a', 'null'), v_result ->> 'streak') || E'\n';

  -- 2. 틀린 선택 거절
  begin
    perform public.answer_daily('c');
    v_log := v_log || E'2. 틀린 선택: ❌ 됨\n';
  exception when others then
    v_log := v_log || '2. 틀린 선택: ' || sqlerrm || E'(invalid_choice)\n';
  end;

  -- 3. 답하기 → 7일째: 출석 5 + 보너스 30, 잔액 +35
  v_before := public.get_my_balance();
  v_result := public.answer_daily('b');
  v_log := v_log || format('3. 답하기: 출석 %s(5) · 보너스 %s(30) · 연속 %s(7) · 잔액 변화 %s(35)',
    v_result ->> 'reward', v_result ->> 'bonus', v_result ->> 'streak', public.get_my_balance() - v_before) || E'\n';

  -- 4. 다시 답하기 → 거절, 포인트 그대로
  v_before := public.get_my_balance();
  begin
    perform public.answer_daily('a');
    v_log := v_log || E'4. 두 번째 답: ❌ 됨\n';
  exception when others then
    v_log := v_log || format('4. 두 번째 답: %s(already_answered) · 잔액 변화 %s(0)', sqlerrm, public.get_my_balance() - v_before) || E'\n';
  end;

  -- 5. 답한 뒤: 비율 보임 (B 1명), 내 선택 b
  v_result := public.get_today_daily();
  v_log := v_log || format('5. 답한 뒤: A %s(0) · B %s(1) · 내 선택 %s(b)',
    v_result ->> 'a', v_result ->> 'b', v_result ->> 'my_choice') || E'\n';

  -- 6. 단체는 답할 수 있지만 포인트 없음
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  v_result := public.answer_daily('a');
  v_log := v_log || format('6. 단체: 출석 %s(0) · 포인트 받는 계정 %s(false)',
    v_result ->> 'reward', public.get_today_daily() ->> 'rewarded') || E'\n';

  -- 7. 내일 질문은 안 보임 (RLS)
  insert into public.daily_questions (day, question, option_a, option_b)
  values (v_today + 1, '내일 질문', '가', '나') on conflict (day) do nothing;
  set local role authenticated;
  v_log := v_log || format('7. 앱에서 보이는 내일 질문: %s(0)',
    (select count(*) from public.daily_questions where day > v_today)) || E'\n';
  reset role;

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
