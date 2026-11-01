-- 월드컵(20261101000002) 확인용 테스트 (2026-11-01)
-- 마이그레이션 적용 후 SQL Editor에서 Run. 마지막에 일부러 오류를 내서 바꾼 내용은 모두 취소된다.
-- 괄호 안이 기대값

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' and approval_status = 'approved' order by created_at limit 1);
  v_w1 bigint;
  v_w2 bigint;
  c bigint[];   -- 월드컵1 후보 id (1~8)
  d bigint[];   -- 월드컵2 후보 id (1~8)
  v_ok jsonb;   -- 월드컵1 정상 대진: 1위 = c[1]
  v_ok2 jsonb;  -- 월드컵2 정상 대진
  v_r jsonb;
  v_before integer;
  v_log text := E'\n';
begin
  if v_student is null or v_org is null then
    raise exception '학생 테스터와 승인된 단체 테스터가 필요해요';
  end if;
  update public.point_rules set value = 100 where key = 'community_daily_cap';
  update public.point_rules set value = 5 where key = 'result_min_count';

  insert into public.worldcups (title, size) values ('테스트 월드컵 1', 8) returning id into v_w1;
  insert into public.worldcup_candidates (worldcup_id, sort_order, name)
  select v_w1, g, '후보' || g from generate_series(1, 8) g;
  insert into public.worldcups (title, size) values ('테스트 월드컵 2', 8) returning id into v_w2;
  insert into public.worldcup_candidates (worldcup_id, sort_order, name)
  select v_w2, g, '다른' || g from generate_series(1, 8) g;
  c := array(select id from public.worldcup_candidates where worldcup_id = v_w1 order by sort_order);
  d := array(select id from public.worldcup_candidates where worldcup_id = v_w2 order by sort_order);

  -- 8강: 1>2, 3>4, 5>6, 7>8 / 4강: 1>3, 5>7 / 결승: 1>5
  v_ok := jsonb_build_array(
    jsonb_build_object('winner', c[1], 'loser', c[2]), jsonb_build_object('winner', c[3], 'loser', c[4]),
    jsonb_build_object('winner', c[5], 'loser', c[6]), jsonb_build_object('winner', c[7], 'loser', c[8]),
    jsonb_build_object('winner', c[1], 'loser', c[3]), jsonb_build_object('winner', c[5], 'loser', c[7]),
    jsonb_build_object('winner', c[1], 'loser', c[5]));
  v_ok2 := jsonb_build_array(
    jsonb_build_object('winner', d[1], 'loser', d[2]), jsonb_build_object('winner', d[3], 'loser', d[4]),
    jsonb_build_object('winner', d[5], 'loser', d[6]), jsonb_build_object('winner', d[7], 'loser', d[8]),
    jsonb_build_object('winner', d[1], 'loser', d[3]), jsonb_build_object('winner', d[5], 'loser', d[7]),
    jsonb_build_object('winner', d[1], 'loser', d[5]));

  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);

  -- 1. 하기 전엔 결과 못 봄
  begin
    perform public.get_worldcup_result(v_w1);
    v_log := v_log || E'1. 하기 전 결과: ❌ 보임\n';
  exception when others then
    v_log := v_log || '1. 하기 전 결과: ' || sqlerrm || E'(not_played)\n';
  end;

  -- 2~5. 조작된 대진 거절
  begin
    perform public.submit_worldcup(v_w1, v_ok - 6);
    v_log := v_log || E'2. 매치 6개: ❌ 됨\n';
  exception when others then
    v_log := v_log || '2. 매치 6개: ' || sqlerrm || E'(invalid_bracket)\n';
  end;
  begin
    -- 결승에서 이미 진 후보2가 다시 나옴
    perform public.submit_worldcup(v_w1, jsonb_set(v_ok, '{6}', jsonb_build_object('winner', c[2], 'loser', c[5])));
    v_log := v_log || E'3. 진 후보 재등장: ❌ 됨\n';
  exception when others then
    v_log := v_log || '3. 진 후보 재등장: ' || sqlerrm || E'(invalid_bracket)\n';
  end;
  begin
    perform public.submit_worldcup(v_w1, jsonb_set(v_ok, '{0}', jsonb_build_object('winner', c[1], 'loser', d[2])));
    v_log := v_log || E'4. 다른 월드컵 후보: ❌ 됨\n';
  exception when others then
    v_log := v_log || '4. 다른 월드컵 후보: ' || sqlerrm || E'(invalid_bracket)\n';
  end;
  begin
    -- 후보1이 매치 4번 (8강은 최대 3번)
    perform public.submit_worldcup(v_w1, jsonb_set(v_ok, '{3}', jsonb_build_object('winner', c[1], 'loser', c[8])));
    v_log := v_log || E'5. 매치 너무 많음: ❌ 됨\n';
  exception when others then
    v_log := v_log || '5. 매치 너무 많음: ' || sqlerrm || E'(invalid_bracket)\n';
  end;

  -- 6. 정상 제출 → 포인트
  select coalesce(sum(amount), 0) into v_before from public.point_ledger where user_id = v_student and status = 'confirmed';
  v_r := public.submit_worldcup(v_w1, v_ok);
  v_log := v_log || format('6. 정상 제출: 보상 %s(%s) · 잔액 +%s', v_r->>'reward', public.point_rule('community_vote'),
    (select coalesce(sum(amount), 0) from public.point_ledger where user_id = v_student and status = 'confirmed') - v_before) || E'\n';

  -- 7. 두 번째 → 거절, 포인트 그대로
  begin
    perform public.submit_worldcup(v_w1, v_ok);
    v_log := v_log || E'7. 두 번째 제출: ❌ 됨\n';
  exception when others then
    v_log := v_log || '7. 두 번째 제출: ' || sqlerrm || E'(already_played)\n';
  end;
  v_log := v_log || format('7-1. 이 월드컵 포인트 기록: %s줄(1)',
    (select count(*) from public.point_ledger where user_id = v_student and ref_id = 'worldcup:' || v_w1)) || E'\n';

  -- 8. 결과: 1위 후보1 (우승 100%, 1:1 3승 0패), 후보2는 0승 1패
  v_r := public.get_worldcup_result(v_w1);
  v_log := v_log || format('8. 결과: 참여 %s(1) · 1위 %s(후보1) · 우승률 %s(100) · 1:1 %s승 %s패(3승 0패)',
    v_r->>'plays', v_r->'ranking'->0->>'name', v_r->'ranking'->0->>'win_rate',
    v_r->'ranking'->0->>'match_wins', v_r->'ranking'->0->>'match_losses') || E'\n';
  v_log := v_log || format('8-1. 후보2: %s승 %s패(0승 1패) · 1:1 승률 %s(0)',
    (select e->>'match_wins' from jsonb_array_elements(v_r->'ranking') e where e->>'name' = '후보2'),
    (select e->>'match_losses' from jsonb_array_elements(v_r->'ranking') e where e->>'name' = '후보2'),
    (select e->>'match_rate' from jsonb_array_elements(v_r->'ranking') e where e->>'name' = '후보2')) || E'\n';

  -- 9. 그룹: 1명뿐이라 숨김 (기준 5)
  v_log := v_log || format('9. 그룹 1위 숨김: %s(true) · 1위 이름 %s(null)',
    coalesce((select bool_and((e->>'hidden')::boolean) from jsonb_array_elements(v_r->'groups') e), true),
    coalesce((select string_agg(e->>'top', ',') from jsonb_array_elements(v_r->'groups') e), 'null')) || E'\n';

  -- 10. 누가 골랐는지 없음
  v_log := v_log || format('10. 결과에 내 정보: %s(없음)',
    case when v_r::text like '%' || v_student::text || '%' then '❌ 있음' else '없음' end) || E'\n';

  -- 11. 기준 1로 낮추면 그룹 1위 보임
  update public.point_rules set value = 1 where key = 'result_min_count';
  v_r := public.get_worldcup_result(v_w1);
  v_log := v_log || format('11. 기준 1: 그룹 1위 %s(후보1)',
    (select string_agg(distinct e->>'top', ',') from jsonb_array_elements(v_r->'groups') e)) || E'\n';

  -- 12. 하루 한도를 다 쓰면 포인트 0 (월드컵2)
  update public.point_rules set value = (select coalesce(sum(amount), 0) from public.point_ledger
                                          where user_id = v_student and reason = 'community'
                                            and created_at >= public.kst_day_start())
   where key = 'community_daily_cap';
  v_r := public.submit_worldcup(v_w2, v_ok2);
  v_log := v_log || format('12. 하루 한도 초과: 보상 %s(0) · 집계는 됨 %s(true)', v_r->>'reward',
    exists (select 1 from public.worldcup_plays where worldcup_id = v_w2 and user_id = v_student)) || E'\n';

  -- 13. 단체는 포인트 없음, 집계는 됨
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  v_r := public.submit_worldcup(v_w1, v_ok);
  v_log := v_log || format('13. 단체: 보상 %s(0) · 참여 수 %s(2)', v_r->>'reward',
    (select count(*) from public.worldcup_plays where worldcup_id = v_w1)) || E'\n';

  -- 14. 월드컵에 댓글
  perform public.create_comment('worldcup', v_w1, '재밌어요');
  v_log := v_log || format('14. 댓글: %s개(1)', jsonb_array_length(public.get_comments('worldcup', v_w1)->'all')) || E'\n';

  -- 15. 목록에 참여 표시
  v_log := v_log || format('15. 목록: 참여 %s(2) · 내가 함 %s(true)',
    (select e->>'plays' from jsonb_array_elements(public.get_worldcups()) e where (e->>'id')::bigint = v_w1),
    (select e->>'played' from jsonb_array_elements(public.get_worldcups()) e where (e->>'id')::bigint = v_w1)) || E'\n';

  -- 16. 앱은 표를 직접 못 읽음
  begin
    set local role authenticated;
    perform count(*) from public.worldcup_plays;
    reset role;
    v_log := v_log || E'16. 참여 표 직접 읽기: ❌ 됨\n';
  exception when others then
    reset role;
    v_log := v_log || '16. 참여 표 직접 읽기: ' || sqlerrm || E'(권한 없음 = 정상)\n';
  end;

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
