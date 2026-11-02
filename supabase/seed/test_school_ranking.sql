-- 학교 대항전(20261102000003) 확인용 테스트 (2026-11-02)
-- 마이그레이션 적용 후 SQL Editor에서 Run. 마지막에 일부러 오류를 내서 바꾼 내용은 모두 취소된다.
-- 학생 테스터가 1명이라, 블록 안에서만 "최소 인원"을 1로 낮춰 계산을 확인하고 2로 올려 숨김을 확인한다.
-- 괄호 안이 기대값

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_school text;
  v_post bigint;
  v_before integer;
  v_r jsonb;
  v_log text := E'\n';
begin
  if v_student is null then
    raise exception '학생 테스터가 필요해요';
  end if;
  select u.name into v_school from public.profiles p join public.universities u on u.id = p.university_id where p.id = v_student;
  update public.point_rules set value = 1 where key = 'result_min_count';

  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  v_before := coalesce((select (e->>'count')::integer from jsonb_array_elements(public.get_school_ranking()->'ranking') e
                         where e->>'school' = v_school), 0);

  -- 이번 주 활동: 글 1개 + 댓글 3개 = 4점
  insert into public.posts (author_id, kind, question, options) values (v_student, 'balance', '대항전 테스트', array['가', '나'])
  returning id into v_post;
  insert into public.comments (target_type, target_id, author_id, body)
  select 'post', v_post, v_student, '댓글' from generate_series(1, 3);
  -- 지난주 댓글 5개 = 세지 않음
  insert into public.comments (target_type, target_id, author_id, body, created_at)
  select 'post', v_post, v_student, '지난주', now() - interval '8 days' from generate_series(1, 5);

  v_r := public.get_school_ranking();
  v_log := v_log || format('1. 내 학교 %s · 점수 증가 %s(4) · 내 순위 %s(1 이상)',
    v_r->>'my_school',
    coalesce((select (e->>'count')::integer from jsonb_array_elements(v_r->'ranking') e where e->>'school' = v_school), 0) - v_before,
    coalesce(v_r->>'my_rank', 'null')) || E'\n';

  v_log := v_log || format('2. 결과에 내 정보: %s(없음)',
    case when v_r::text like '%' || v_student::text || '%' then '❌ 있음' else '없음' end) || E'\n';

  -- 3. 활동한 학생이 기준보다 적으면 순위에서 빠짐 (학생 1명 < 기준 2명)
  update public.point_rules set value = 2 where key = 'result_min_count';
  v_r := public.get_school_ranking();
  v_log := v_log || format('3. 기준 2명: 내 학교 순위에 있음 %s(false) · 내 순위 %s(null)',
    exists (select 1 from jsonb_array_elements(v_r->'ranking') e where e->>'school' = v_school),
    coalesce(v_r->>'my_rank', 'null')) || E'\n';

  -- 4. 로그인 안 하면 거절
  perform set_config('request.jwt.claims', '{}', true);
  begin
    perform public.get_school_ranking();
    v_log := v_log || E'4. 로그인 없이: ❌ 됨\n';
  exception when others then
    v_log := v_log || '4. 로그인 없이: ' || sqlerrm || E'(not_authenticated)\n';
  end;

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
