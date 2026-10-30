-- 커뮤니티 2-2(20261030000021) 확인용 테스트 (2026-10-30)
-- 마이그레이션(000021, 000022) 적용 후 SQL Editor에서 Run. 마지막에 일부러 오류를 내서 바꾼 내용은 모두 취소된다.

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' order by created_at limit 1);
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_post bigint;
  v_q bigint;
  v_result jsonb;
  v_log text := E'\n';
begin
  update public.point_rules set value = 1 where key = 'result_min_count';
  update public.profiles set gender = 'female', birth_year = extract(year from now())::integer - 22,
                             nickname_changed_at = null where id = v_student;
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);

  -- 1. 금칙어: 글·띄어쓴 욕설·댓글 거절
  begin
    perform public.create_post('balance', '이거 시 발 뭐임', array['가', '나']);
    v_log := v_log || E'1. 띄어 쓴 욕설 글: ❌ 됨\n';
  exception when others then
    v_log := v_log || '1. 띄어 쓴 욕설 글: ' || sqlerrm || E'(banned_word)\n';
  end;
  v_post := public.create_post('balance', '짜장 vs 짬뽕', array['짜장', '짬뽕']);
  begin
    perform public.create_comment('post', v_post, '병신같은 질문');
    v_log := v_log || E'   욕설 댓글: ❌ 됨\n';
  exception when others then
    v_log := v_log || '   욕설 댓글: ' || sqlerrm || E'(banned_word)\n';
  end;

  -- 2. 닉네임: 사칭 거절 → 정상 변경 → 30일 안에 다시 바꾸기 거절
  begin
    perform public.change_nickname('옛썰운영팀');
    v_log := v_log || E'2. 사칭 닉네임: ❌ 됨\n';
  exception when others then
    v_log := v_log || '2. 사칭 닉네임: ' || sqlerrm || E'(banned_word)\n';
  end;
  perform public.change_nickname('새닉네임테스트');
  v_log := v_log || format('   변경: %s(새닉네임테스트)', (select nickname from public.profiles where id = v_student)) || E'\n';
  begin
    perform public.change_nickname('또바꿈');
    v_log := v_log || E'   30일 안 재변경: ❌ 됨\n';
  exception when others then
    v_log := v_log || '   30일 안 재변경: ' || sqlerrm || E'(nickname_cooldown)\n';
  end;

  -- 3. 단체는 닉네임 변경 불가
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  begin
    perform public.change_nickname('단체닉');
    v_log := v_log || E'3. 단체 닉네임 변경: ❌ 됨\n';
  exception when others then
    v_log := v_log || '3. 단체 닉네임 변경: ' || sqlerrm || E'(nickname_student_only)\n';
  end;

  -- 4. 오늘의 질문 상세 (20261030000022 이후): 답하기 전 그룹 숨김 → 답한 뒤 그룹·댓글 수
  delete from public.daily_questions where day = v_today;
  insert into public.daily_questions (day, question, option_a, option_b)
  values (v_today, '오늘 질문', '예', '아니요') returning id into v_q;
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  v_log := v_log || format('4. 답하기 전 그룹: %s(null)',
    coalesce(public.get_today_daily() ->> 'groups', 'null')) || E'\n';
  perform public.answer_daily('b');
  perform public.create_comment('daily', v_q, '저도 아니요');
  v_result := public.get_today_daily();
  v_log := v_log || format('   답한 뒤: 성별 %s(여성) · [A, B] %s([0, 1]) · 댓글 %s(1)',
    v_result #>> '{groups,gender,0,label}', v_result #> '{groups,gender,0,counts}', v_result ->> 'comment_count') || E'\n';

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
