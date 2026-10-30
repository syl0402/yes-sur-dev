-- 커뮤니티 1단계(20261030000019) 확인용 테스트 (2026-10-30)
-- 마이그레이션 적용 후 SQL Editor에서 Run. 마지막에 일부러 오류를 내서 바꾼 내용은 모두 취소된다.

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' order by created_at limit 1);
  v_p1 bigint;
  v_p2 bigint;
  v_p3 bigint;
  v_mine bigint;
  v_result jsonb;
  v_before integer;
  v_log text := E'\n';
begin
  update public.point_rules set value = 1 where key = 'result_min_count';
  update public.point_rules set value = 3 where key = 'community_daily_cap';
  update public.point_rules set value = 1 where key = 'creator_bonus_every';
  update public.profiles set gender = 'female', birth_year = extract(year from now())::integer - 22 where id = v_student;

  -- 단체가 글 3개
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  v_p1 := public.create_post('balance', '짜장 vs 짬뽕', array['짜장', '짬뽕']);
  v_p2 := public.create_post('relate', '시험 전날에만 방 청소하고 싶어진다', null);
  v_p3 := public.create_post('pick', '노트북 뭐 살까', array['맥북', '그램', '갤럭시북']);

  -- 1. 잘못된 글 거절 (밸런스인데 보기 3개)
  begin
    perform public.create_post('balance', '셋 중 하나', array['가', '나', '다']);
    v_log := v_log || E'1. 밸런스 보기 3개: ❌ 됨\n';
  exception when others then
    v_log := v_log || '1. 밸런스 보기 3개: ' || sqlerrm || E'(invalid_post)\n';
  end;

  -- 2. 나만 그래?는 보기가 고정
  v_log := v_log || format('2. 나만 그래? 보기: %s(["나도 그래", "나는 아냐"])',
    (select to_jsonb(options) from public.posts where id = v_p2)) || E'\n';

  -- 3. 학생: 투표 전엔 비율 숨김 → 투표 +2P → 비율·그룹 보임 → 두 번째 투표 거절
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  v_result := public.get_post(v_p1);
  v_log := v_log || format('3. 투표 전 비율: %s(null)', coalesce(v_result ->> 'counts', 'null')) || E'\n';
  v_before := public.get_my_balance();
  v_result := public.vote_post(v_p1, 1);
  v_log := v_log || format('   투표: +%s(2) · 잔액 변화 %s(2)', v_result ->> 'reward', public.get_my_balance() - v_before) || E'\n';
  v_result := public.get_post(v_p1);
  v_log := v_log || format('   투표 후: 비율 %s([0, 1]) · 성별 그룹 %s(여성)',
    v_result -> 'counts', v_result #>> '{groups,gender,0,label}') || E'\n';
  begin
    perform public.vote_post(v_p1, 0);
    v_log := v_log || E'   두 번째 투표: ❌ 됨\n';
  exception when others then
    v_log := v_log || '   두 번째 투표: ' || sqlerrm || E'(already_voted)\n';
  end;

  -- 4. 하루 상한 (테스트에서 3P): 두 번째 +1, 세 번째 +0
  v_log := v_log || format('4. 하루 상한: 두 번째 +%s(1) · 세 번째 +%s(0)',
    public.vote_post(v_p2, 0) ->> 'reward', public.vote_post(v_p3, 2) ->> 'reward') || E'\n';

  -- 5. 내 글에 투표하면 포인트 없음 (상한 다시 넉넉히)
  update public.point_rules set value = 100 where key = 'community_daily_cap';
  v_mine := public.create_post('balance', '아침형 vs 저녁형', array['아침형', '저녁형']);
  v_log := v_log || format('5. 내 글 투표: +%s(0)', public.vote_post(v_mine, 0) ->> 'reward') || E'\n';

  -- 6. 만든 사람 보너스 (테스트에서 투표 1개마다): 단체가 학생 글에 투표 → 학생 +10, 단체는 포인트 없음
  select coalesce(sum(amount), 0)::integer into v_before from public.point_ledger where user_id = v_student and status = 'confirmed';
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  v_result := public.vote_post(v_mine, 1);
  v_log := v_log || format('6. 만든 사람 보너스: 학생 +%s(10) · 단체 투표 보상 %s(0)',
    (select coalesce(sum(amount), 0)::integer from public.point_ledger where user_id = v_student and status = 'confirmed') - v_before,
    v_result ->> 'reward') || E'\n';

  -- 7. 하루 글 개수 제한 (테스트에서 1개 → 단체는 이미 3개라 거절)
  update public.point_rules set value = 1 where key = 'post_daily_max';
  begin
    perform public.create_post('balance', '하나 더', array['가', '나']);
    v_log := v_log || E'7. 하루 글 제한: ❌ 됨\n';
  exception when others then
    v_log := v_log || '7. 하루 글 제한: ' || sqlerrm || E'(post_limit)\n';
  end;

  -- 8. 피드: 숨긴 글은 안 보임, 작성자 이름 표시
  update public.posts set moderation = 'hidden' where id = v_p3;
  v_result := public.get_feed();
  v_log := v_log || format('8. 피드: 숨긴 글 보임 %s(false) · 학생 글 작성자 %s(닉네임)',
    v_result @> jsonb_build_array(jsonb_build_object('id', v_p3)),
    (select e ->> 'author' from jsonb_array_elements(v_result) e where (e ->> 'id')::bigint = v_mine)) || E'\n';

  -- 9. 앱에서 표를 직접 읽을 수 없음
  set local role authenticated;
  begin
    perform count(*) from public.post_votes;
    v_log := v_log || E'9. 투표 표 직접 읽기: ❌ 됨\n';
  exception when others then
    v_log := v_log || E'9. 투표 표 직접 읽기: 거절(권한 없음)\n';
  end;
  reset role;

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
