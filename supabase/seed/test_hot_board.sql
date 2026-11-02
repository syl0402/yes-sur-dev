-- HOT 게시판(20261103000001) 확인용 테스트 (2026-11-03)
-- 마이그레이션 적용 후 SQL Editor에서 Run. 마지막에 일부러 오류를 내서 바꾼 내용은 모두 취소된다.
-- 괄호 안이 기대값

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_post bigint;  -- 최근 글 · 반응 4
  v_cup bigint;   -- 월드컵 · 최근 참여 5 + 댓글 1
  v_old bigint;   -- 월드컵 · 10일 전 참여 9 → 빠짐
  v_list jsonb;
  v_ids text[];
  v_log text := E'\n';
begin
  if v_student is null then
    raise exception '학생 테스터가 필요해요';
  end if;
  -- 블록 안에서만: 최소 반응 3, 개수는 넉넉히 (다른 글과 섞여도 확인되게)
  update public.point_rules set value = 3 where key = 'weekly_best_min';
  update public.point_rules set value = 100 where key = 'weekly_best_count';

  insert into public.posts (author_id, kind, question, options) values (v_student, 'balance', 'HOT 글', array['가', '나']) returning id into v_post;
  insert into public.post_votes (post_id, user_id, choice) select v_post, null, 0 from generate_series(1, 4);

  insert into public.worldcups (title, size) values ('HOT 월드컵', 8) returning id into v_cup;
  insert into public.worldcups (title, size) values ('옛날 월드컵', 8) returning id into v_old;
  insert into public.worldcup_candidates (worldcup_id, sort_order, name)
    select w, g, '후보' || g from unnest(array[v_cup, v_old]) as w, generate_series(1, 8) as g;
  -- 참여(계정 없이): 최근 5 / 10일 전 9
  insert into public.worldcup_plays (worldcup_id, user_id, winner_id)
    select v_cup, null, (select id from public.worldcup_candidates where worldcup_id = v_cup order by sort_order limit 1)
      from generate_series(1, 5);
  insert into public.worldcup_plays (worldcup_id, user_id, winner_id, created_at)
    select v_old, null, (select id from public.worldcup_candidates where worldcup_id = v_old order by sort_order limit 1),
           now() - interval '10 days'
      from generate_series(1, 9);
  insert into public.comments (target_type, target_id, author_id, body) values ('worldcup', v_cup, v_student, '댓글');

  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  v_list := public.get_weekly_best();
  select array_agg((e->>'type') || ':' || (e->>'id') order by ord) into v_ids
    from jsonb_array_elements(v_list) with ordinality as t(e, ord);

  v_log := v_log || format('1. 월드컵 들어감: %s(true) · 참여 %s(5) · 댓글 %s(1) · kind %s(worldcup)',
    ('worldcup:' || v_cup) = any (v_ids),
    (select e->>'votes' from jsonb_array_elements(v_list) e where e->>'type' = 'worldcup' and (e->>'id')::bigint = v_cup),
    (select e->>'comment_count' from jsonb_array_elements(v_list) e where e->>'type' = 'worldcup' and (e->>'id')::bigint = v_cup),
    (select e->>'kind' from jsonb_array_elements(v_list) e where e->>'type' = 'worldcup' and (e->>'id')::bigint = v_cup)) || E'\n';
  v_log := v_log || format('2. 10일 전 참여만 있는 월드컵 빠짐: %s(true)', not (('worldcup:' || v_old) = any (v_ids))) || E'\n';
  v_log := v_log || format('3. 글도 들어감(type post): %s(true)', ('post:' || v_post) = any (v_ids)) || E'\n';
  v_log := v_log || format('4. 월드컵(6)이 글(4)보다 앞: %s(true)',
    array_position(v_ids, 'worldcup:' || v_cup) < array_position(v_ids, 'post:' || v_post)) || E'\n';
  v_log := v_log || format('5. 작성자 정보 없음: %s(true)', v_list::text not like '%' || v_student::text || '%') || E'\n';

  -- 6. 개수 제한 (마이그레이션 기본값 5로 되돌려 확인)
  update public.point_rules set value = 5 where key = 'weekly_best_count';
  v_log := v_log || format('6. 개수 5: %s개(5 이하)', jsonb_array_length(public.get_weekly_best())) || E'\n';

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
