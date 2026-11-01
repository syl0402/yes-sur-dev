-- 주간 베스트(20261101000001) 확인용 테스트 (2026-11-01)
-- 마이그레이션 적용 후 SQL Editor에서 Run. 마지막에 일부러 오류를 내서 바꾼 내용은 모두 취소된다.
-- 괄호 안이 기대값

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' and approval_status = 'approved' order by created_at limit 1);
  v_a bigint;  -- 최근 · 반응 5
  v_b bigint;  -- 최근 · 반응 2
  v_old bigint;  -- 10일 전 · 반응 9 → 빠짐
  v_hidden bigint;  -- 숨김 · 반응 9 → 빠짐
  v_promo bigint;  -- 마감된 설문 홍보 · 반응 9 → 빠짐
  v_survey bigint;
  v_list jsonb;
  v_ids bigint[];
  v_log text := E'\n';
begin
  if v_student is null or v_org is null then
    raise exception '학생 테스터와 승인된 단체 테스터가 필요해요';
  end if;
  -- 블록 안에서만: 최소 반응 3, 개수는 넉넉히 (다른 글과 섞여도 확인되게)
  update public.point_rules set value = 3 where key = 'weekly_best_min';
  update public.point_rules set value = 100 where key = 'weekly_best_count';

  insert into public.posts (author_id, kind, question, options) values (v_student, 'balance', '베스트 A', array['가', '나']) returning id into v_a;
  insert into public.posts (author_id, kind, question, options) values (v_student, 'balance', '베스트 B', array['가', '나']) returning id into v_b;
  insert into public.posts (author_id, kind, question, options, created_at)
  values (v_student, 'balance', '오래된 글', array['가', '나'], now() - interval '10 days') returning id into v_old;
  insert into public.posts (author_id, kind, question, options, moderation)
  values (v_student, 'balance', '숨긴 글', array['가', '나'], 'hidden') returning id into v_hidden;

  -- 마감된 설문의 홍보 글
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  v_survey := public.create_survey(gen_random_uuid(), (select id from public.survey_categories where key = 'life'),
    '베스트 홍보 테스트', null, 'all', 10, 3, '[{"type": "single", "text": "하나", "options": ["가", "나"]}]');
  update public.surveys set status = 'closed' where id = v_survey;
  insert into public.posts (author_id, kind, question, options, survey_id)
  values (v_org, 'promo', '마감 설문 홍보', '{}', v_survey) returning id into v_promo;

  -- 반응 넣기: 투표(계정 없이) + 댓글
  insert into public.post_votes (post_id, user_id, choice) select v_a, null, 0 from generate_series(1, 4);
  insert into public.comments (target_type, target_id, author_id, body) values ('post', v_a, v_student, '댓글');
  insert into public.post_votes (post_id, user_id, choice) select v_b, null, 1 from generate_series(1, 2);
  insert into public.post_votes (post_id, user_id, choice) select p, null, 0
    from unnest(array[v_old, v_hidden, v_promo]) as p, generate_series(1, 9);

  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  v_list := public.get_weekly_best();
  select array_agg((e->>'id')::bigint order by ord) into v_ids
    from jsonb_array_elements(v_list) with ordinality as t(e, ord);

  v_log := v_log || format('1. A(반응 5) 들어감: %s(true) · 투표 %s(4) · 댓글 %s(1)', v_a = any (v_ids),
    (select e->>'votes' from jsonb_array_elements(v_list) e where (e->>'id')::bigint = v_a),
    (select e->>'comment_count' from jsonb_array_elements(v_list) e where (e->>'id')::bigint = v_a)) || E'\n';
  v_log := v_log || format('2. B(반응 2, 기준 3 미만) 빠짐: %s(true)', not (v_b = any (v_ids))) || E'\n';
  v_log := v_log || format('3. 10일 전 글 빠짐: %s(true)', not (v_old = any (v_ids))) || E'\n';
  v_log := v_log || format('4. 숨긴 글 빠짐: %s(true)', not (v_hidden = any (v_ids))) || E'\n';
  v_log := v_log || format('5. 마감 설문 홍보 글 빠짐: %s(true)', not (v_promo = any (v_ids))) || E'\n';
  v_log := v_log || format('6. 작성자 정보 없음: %s(true)', v_list::text not like '%' || v_student::text || '%') || E'\n';

  -- 7. 기준을 낮추면 B도 들어가고 A보다 뒤
  update public.point_rules set value = 1 where key = 'weekly_best_min';
  v_list := public.get_weekly_best();
  select array_agg((e->>'id')::bigint order by ord) into v_ids
    from jsonb_array_elements(v_list) with ordinality as t(e, ord);
  v_log := v_log || format('7. 기준 1: B 들어감 %s(true) · A가 B보다 앞 %s(true)', v_b = any (v_ids),
    array_position(v_ids, v_a) < array_position(v_ids, v_b)) || E'\n';

  -- 8. 개수 제한
  update public.point_rules set value = 1 where key = 'weekly_best_count';
  v_log := v_log || format('8. 개수 1로: %s개(1 이하)', jsonb_array_length(public.get_weekly_best())) || E'\n';

  -- 9. 로그인 안 하면 거절
  perform set_config('request.jwt.claims', '{}', true);
  begin
    perform public.get_weekly_best();
    v_log := v_log || E'9. 로그인 없이: ❌ 됨\n';
  exception when others then
    v_log := v_log || '9. 로그인 없이: ' || sqlerrm || E'(not_authenticated)\n';
  end;

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
