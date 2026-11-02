-- 익명 번호 · 대댓글 · 베스트 댓글(20261103000002) 확인용 테스트 (2026-11-03)
-- 마이그레이션 적용 후 SQL Editor에서 Run. 마지막에 일부러 오류를 내서 바꾼 내용은 모두 취소된다.
-- 학생 2명 + 승인된 단체 1개, 또는 학생 1명 + 승인된 단체 2개가 필요. 학생이 1명뿐이면 두 번째 단체 계정을 블록 안에서만 학생으로 바꿔 쓴다
-- (운영자 학생 계정도 블록 안에서만 일반 학생으로). 괄호 안이 기대값

do $$
declare
  -- 일반 학생을 먼저, 모자라면 운영자 학생 계정도 쓴다 (블록 안에서만 일반 학생으로 바꿈)
  v_a uuid := (select id from public.profiles where account_type = 'student' order by role = 'admin', created_at limit 1);
  v_b uuid := (select id from public.profiles where account_type = 'student' order by role = 'admin', created_at offset 1 limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' and approval_status = 'approved' order by created_at limit 1);
  v_p1 bigint;  -- A의 익명 글
  v_p2 bigint;  -- 단체 글 (익명 불가)
  v_c_b bigint; -- P1: B 익명 댓글
  v_c_a bigint; -- P1: A(글쓴이) 익명 댓글
  v_c_r bigint; -- P1: B가 A 댓글에 답글
  v_c_x bigint; -- P2: A 익명 댓글
  v_all jsonb;
  v_log text := E'\n';
  claims_a text;
  claims_b text;
  claims_org text;
begin
  -- 학생이 1명뿐: 두 번째 승인된 단체를 잠깐 학생으로 (첫 학생과 같은 학교)
  if v_b is null and v_a is not null then
    v_b := (select id from public.profiles where account_type = 'org' and approval_status = 'approved'
             and id is distinct from v_org order by created_at limit 1);
    update public.profiles
       set account_type = 'student', university_id = (select university_id from public.profiles where id = v_a),
           nickname = coalesce(nickname, '테스트B' || left(md5(random()::text), 6))
     where id = v_b;
  end if;
  if v_a is null or v_b is null or v_org is null then
    raise exception '학생 1명과 승인된 단체 2개(또는 학생 2명 + 단체 1개)가 필요해요 (학생 %명, 승인된 단체 %개)',
      (select count(*) from public.profiles where account_type = 'student'),
      (select count(*) from public.profiles where account_type = 'org' and approval_status = 'approved');
  end if;
  update public.profiles set role = 'user' where id in (v_a, v_b);
  claims_a := json_build_object('sub', v_a, 'role', 'authenticated')::text;
  claims_b := json_build_object('sub', v_b, 'role', 'authenticated')::text;
  claims_org := json_build_object('sub', v_org, 'role', 'authenticated')::text;

  -- 글 2개
  perform set_config('request.jwt.claims', claims_a, true);
  v_p1 := public.create_post('balance', '익명 테스트 글', array['가', '나']);
  perform set_config('request.jwt.claims', claims_org, true);
  v_p2 := public.create_post('balance', '단체 테스트 글', array['가', '나'], null, true);

  -- P1 댓글: B 익명 → A(글쓴이) 익명 → 단체(익명 요청해도 단체 이름) → B 닉네임 공개 → B 익명 한 번 더
  perform set_config('request.jwt.claims', claims_b, true);
  v_c_b := public.create_comment('post', v_p1, 'B 익명');
  perform set_config('request.jwt.claims', claims_a, true);
  v_c_a := public.create_comment('post', v_p1, 'A 글쓴이');
  perform set_config('request.jwt.claims', claims_org, true);
  perform public.create_comment('post', v_p1, '단체 댓글', null, true);
  perform set_config('request.jwt.claims', claims_b, true);
  perform public.create_comment('post', v_p1, 'B 닉네임', null, false);
  perform public.create_comment('post', v_p1, 'B 익명 두 번째');
  -- 답글: B가 A 댓글에
  v_c_r := public.create_comment('post', v_p1, 'B 답글', v_c_a);

  -- P2 댓글: A 익명 (P2에서는 처음이라 익명1)
  perform set_config('request.jwt.claims', claims_a, true);
  v_c_x := public.create_comment('post', v_p2, 'A 다른 글');

  -- 목록 이름
  perform set_config('request.jwt.claims', claims_b, true);
  v_log := v_log || format('1. 글 이름: 학생 익명 글 %s(익명) · 단체 글 %s(단체 이름)',
    public.get_post(v_p1)->>'author', public.get_post(v_p2)->>'author') || E'\n';

  v_all := public.get_comments('post', v_p1)->'all';
  v_log := v_log || format('2. P1 댓글 이름: %s (익명1, 익명(글쓴이), 단체 이름, B 닉네임, 익명1)',
    (select string_agg(e->>'author', ', ' order by ord) from jsonb_array_elements(v_all) with ordinality t(e, ord))) || E'\n';
  v_log := v_log || format('3. 답글은 A 댓글 아래에: %s(B 답글) · 답글 이름 %s(익명1) · 원댓글 수 %s(5)',
    (select r->>'body' from jsonb_array_elements(v_all) e, jsonb_array_elements(e->'replies') r where (e->>'id')::bigint = v_c_a),
    (select r->>'author' from jsonb_array_elements(v_all) e, jsonb_array_elements(e->'replies') r where (e->>'id')::bigint = v_c_a),
    jsonb_array_length(v_all)) || E'\n';
  v_log := v_log || format('4. 다른 글(P2)에서 A는 %s(익명1)',
    (select e->>'author' from jsonb_array_elements(public.get_comments('post', v_p2)->'all') e where (e->>'id')::bigint = v_c_x)) || E'\n';

  -- 5. 답글에 답글 / 다른 글 댓글에 답글 → 거절
  begin
    perform public.create_comment('post', v_p1, '답글의 답글', v_c_r);
    v_log := v_log || E'5. 답글에 답글: ❌ 됨\n';
  exception when others then
    v_log := v_log || '5. 답글에 답글: ' || sqlerrm || E'(comment_not_found)\n';
  end;
  begin
    perform public.create_comment('post', v_p1, '다른 글 댓글에 답글', v_c_x);
    v_log := v_log || E'6. 다른 글 댓글에 답글: ❌ 됨\n';
  exception when others then
    v_log := v_log || '6. 다른 글 댓글에 답글: ' || sqlerrm || E'(comment_not_found)\n';
  end;

  -- 7. 베스트: 공감 1개 → 기준 3이면 없음, 기준 1이면 들어감
  perform public.like_comment(v_c_a);
  v_log := v_log || format('7. 공감 1개 · 기준 3: 베스트 %s개(0)', jsonb_array_length(public.get_comments('post', v_p1)->'best')) || E'\n';
  update public.point_rules set value = 1 where key = 'best_comment_min';
  v_log := v_log || format('8. 기준 1: 베스트 %s개(1)', jsonb_array_length(public.get_comments('post', v_p1)->'best')) || E'\n';

  -- 9. A가 답글 달린 댓글을 지우면: 자리 남음(deleted) + 본문·이름 비움 + 답글 그대로
  perform set_config('request.jwt.claims', claims_a, true);
  perform public.delete_comment(v_c_a);
  perform set_config('request.jwt.claims', claims_b, true);
  v_all := public.get_comments('post', v_p1)->'all';
  v_log := v_log || format('9. 지운 원댓글: deleted %s(true) · 본문 "%s"("") · 답글 %s개(1)',
    (select e->>'deleted' from jsonb_array_elements(v_all) e where (e->>'id')::bigint = v_c_a),
    (select e->>'body' from jsonb_array_elements(v_all) e where (e->>'id')::bigint = v_c_a),
    (select jsonb_array_length(e->'replies') from jsonb_array_elements(v_all) e where (e->>'id')::bigint = v_c_a)) || E'\n';

  -- 10. 번호는 지워도 그대로: B는 여전히 익명1
  v_log := v_log || format('10. 지운 뒤 B 이름: %s(익명1)',
    (select e->>'author' from jsonb_array_elements(v_all) e where (e->>'id')::bigint = v_c_b)) || E'\n';

  -- 11. 누가 썼는지 안 나감
  v_log := v_log || format('11. author_id 안 나감: %s(true)',
    public.get_comments('post', v_p1)::text not like '%' || v_a::text || '%'
    and public.get_post(v_p1)::text not like '%' || v_a::text || '%') || E'\n';

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
