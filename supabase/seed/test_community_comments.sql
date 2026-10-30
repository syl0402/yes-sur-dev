-- 커뮤니티 2-1(20261030000020) 확인용 테스트 (2026-10-30)
-- 마이그레이션 적용 후 SQL Editor에서 Run. 마지막에 일부러 오류를 내서 바꾼 내용은 모두 취소된다.

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' order by created_at limit 1);
  v_post bigint;
  v_c1 bigint;
  v_c2 bigint;
  v_result jsonb;
  v_log text := E'\n';
begin
  update public.point_rules set value = 1 where key = 'report_hide_count';

  -- 학생이 본문 있는 글
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  v_post := public.create_post('balance', '짜장 vs 짬뽕', array['짜장', '짬뽕'], '  점심 메뉴 고민 중  ');
  v_log := v_log || format('1. 본문 저장: "%s"(앞뒤 공백 없음)', public.get_post(v_post) ->> 'body') || E'\n';

  -- 2. 본문 수정은 작성자만
  perform public.update_post_body(v_post, '수정한 본문');
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  begin
    perform public.update_post_body(v_post, '남이 수정');
    v_log := v_log || E'2. 남의 글 수정: ❌ 됨\n';
  exception when others then
    v_log := v_log || format('2. 본문 "%s"(수정한 본문) · 남의 글 수정 %s(post_not_found)',
      public.get_post(v_post) ->> 'body', sqlerrm) || E'\n';
  end;

  -- 3. 댓글: 단체 댓글 2개, 학생 댓글 1개 → 학생이 단체 댓글 하나에 좋아요
  v_c1 := public.create_comment('post', v_post, '짬뽕이죠');
  v_c2 := public.create_comment('post', v_post, '짜장도 좋아요');
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  perform public.create_comment('post', v_post, '고민되네요');
  v_result := public.like_comment(v_c2);
  v_log := v_log || format('3. 좋아요: liked %s(true) · likes %s(1)', v_result ->> 'liked', v_result ->> 'likes') || E'\n';

  -- 4. 목록: 베스트 1개(좋아요 받은 v_c2), 전체 3개, 댓글 수 3
  v_result := public.get_comments('post', v_post);
  v_log := v_log || format('4. 베스트 %s개(1) "%s"(짜장도 좋아요) · 전체 %s개(3) · 글의 댓글 수 %s(3)',
    jsonb_array_length(v_result -> 'best'), v_result #>> '{best,0,body}',
    jsonb_array_length(v_result -> 'all'), public.get_post(v_post) ->> 'comment_count') || E'\n';

  -- 5. 좋아요 다시 누르면 취소
  v_result := public.like_comment(v_c2);
  v_log := v_log || format('5. 좋아요 취소: liked %s(false) · likes %s(0)', v_result ->> 'liked', v_result ->> 'likes') || E'\n';

  -- 6. 남의 댓글 삭제 거절, 내 댓글 신고 거절
  begin
    perform public.delete_comment(v_c1);
    v_log := v_log || E'6. 남의 댓글 삭제: ❌ 됨\n';
  exception when others then
    v_log := v_log || '6. 남의 댓글 삭제: ' || sqlerrm || E'(comment_not_found)\n';
  end;

  -- 7. 댓글 신고 (기준 1명) → 숨김 → 목록 2개
  perform public.report_content('comment', v_c1, 'abuse');
  v_log := v_log || format('7. 댓글 신고 후: 상태 %s(hidden) · 목록 %s개(2)',
    (select moderation from public.comments where id = v_c1),
    jsonb_array_length(public.get_comments('post', v_post) -> 'all')) || E'\n';

  -- 8. 내 글 삭제 → 피드·상세에서 사라짐, 이미 받은 포인트는 그대로
  perform public.delete_post(v_post);
  begin
    perform public.get_post(v_post);
    v_log := v_log || E'8. 삭제한 글 보기: ❌ 보임\n';
  exception when others then
    v_log := v_log || format('8. 삭제한 글: 상세 %s(post_not_found) · 피드에 있음 %s(false)',
      sqlerrm, public.get_feed() @> jsonb_build_array(jsonb_build_object('id', v_post))) || E'\n';
  end;

  -- 9. 앱에서 댓글 표를 직접 읽을 수 없음
  set local role authenticated;
  begin
    perform count(*) from public.comments;
    v_log := v_log || E'9. 댓글 표 직접 읽기: ❌ 됨\n';
  exception when others then
    v_log := v_log || E'9. 댓글 표 직접 읽기: 거절(권한 없음)\n';
  end;
  reset role;

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
