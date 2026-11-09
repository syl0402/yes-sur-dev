-- 마이 탭 "내가 쓴 글" (2026-11-10 개인 피드백 9번)
-- 내가 쓴 커뮤니티 글·댓글을 최신순으로. 본인 것만 (auth.uid()), 읽기만 한다.
-- 익명으로 쓴 글도 본인에게는 보인다 (다른 사람에게는 지금처럼 익명)
-- 내가 지운 글·댓글(deleted)은 빼고, 신고로 숨겨짐(hidden)·운영자 삭제(removed)는 상태와 함께 보여 준다

-- 1. 내 글: [{ id, kind, question, moderation, created_at, votes, comment_count }]
create or replace function public.get_my_posts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  return coalesce((
    select jsonb_agg(
             jsonb_build_object(
               'id', p.id,
               'kind', p.kind,
               'question', p.question,
               'moderation', p.moderation,
               'created_at', p.created_at,
               'votes', (select count(*) from public.post_votes v where v.post_id = p.id),
               'comment_count', (select count(*) from public.comments c
                                  where c.target_type = 'post' and c.target_id = p.id and c.moderation = 'visible')
             )
             order by p.created_at desc)
      from public.posts p
     where p.author_id = v_uid and p.moderation <> 'deleted'
  ), '[]'::jsonb);
end;
$$;

-- 2. 내 댓글: [{ id, body, moderation, created_at, target_type, target_id, target_title, today }]
--   target_title: 글 질문 / 오늘의 질문 / 월드컵 제목. today: 오늘의 질문이 오늘 것인지 (지난 질문은 화면이 없음)
--   지워진 글에 단 댓글은 뺀다 (눌러도 갈 곳이 없음)
create or replace function public.get_my_comments()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  return coalesce((
    select jsonb_agg(
             jsonb_build_object(
               'id', c.id,
               'body', c.body,
               'moderation', c.moderation,
               'created_at', c.created_at,
               'target_type', c.target_type,
               'target_id', c.target_id,
               'target_title', case c.target_type
                                 when 'post' then p.question
                                 when 'daily' then d.question
                                 when 'worldcup' then w.title
                               end,
               'today', c.target_type = 'daily' and d.day = v_today
             )
             order by c.created_at desc)
      from public.comments c
      left join public.posts p on c.target_type = 'post' and p.id = c.target_id
      left join public.daily_questions d on c.target_type = 'daily' and d.id = c.target_id
      left join public.worldcups w on c.target_type = 'worldcup' and w.id = c.target_id
     where c.author_id = v_uid
       and c.moderation <> 'deleted'
       and (c.target_type <> 'post' or (p.id is not null and p.moderation <> 'deleted'))
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_my_posts() from public, anon;
revoke all on function public.get_my_comments() from public, anon;
grant execute on function public.get_my_posts() to authenticated;
grant execute on function public.get_my_comments() to authenticated;
