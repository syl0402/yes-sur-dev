-- 2026-11-14 커뮤니티 시안 ②: 투표 글 댓글에 "글쓴 사람이 고른 편" 배지
-- get_comments 댓글마다 side 추가: 그 댓글 작성자가 이 글에 투표한 보기 번호 (0부터). 안 했으면 null
--   - 글(post) 댓글에만. 오늘의 질문·월드컵 댓글은 늘 null
--   - 보는 사람이 투표했거나 글쓴이일 때만 보낸다 (결과를 보기 전에 댓글로 쏠림이 드러나지 않게, 결과 공개 규칙과 같음)
--   - 지운·숨긴 댓글은 null
-- 나머지는 20261103000002와 같음

create or replace function public.get_comments(p_type text, p_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_best_min integer := public.point_rule('best_comment_min')::integer;
  v_post_author uuid;
  v_show_side boolean := false;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not public.comment_target_ok(p_type, p_id) then
    raise exception 'post_not_found';
  end if;
  if p_type = 'post' then
    select author_id into v_post_author from public.posts where id = p_id;
    v_show_side := v_post_author = v_uid
                   or exists (select 1 from public.post_votes where post_id = p_id and user_id = v_uid);
  end if;

  return (
    with base as (
      select c.* from public.comments c where c.target_type = p_type and c.target_id = p_id
    ),
    -- 익명 번호: 글쓴이를 뺀 익명 작성자를 처음 댓글 단 순서대로 (지운·숨긴 댓글 포함)
    nums as (
      select author_id, row_number() over (order by min(id)) as n
        from base
       where anonymous and author_id is not null and author_id is distinct from v_post_author
         and public.can_post_anonymously(author_id)
       group by author_id
    ),
    shown as (
      select b.id, b.parent_id, b.body, b.moderation, b.created_at, b.author_id,
             case
               when b.author_id is null then case when b.anonymous then '익명' else '탈퇴한 회원' end
               when not b.anonymous or not public.can_post_anonymously(b.author_id) then public.display_name(b.author_id)
               when b.author_id = v_post_author then '익명(글쓴이)'
               else '익명' || n.n
             end as author,
             case when v_show_side and b.author_id is not null then
               (select v.choice from public.post_votes v where v.post_id = p_id and v.user_id = b.author_id)
             end as side,
             (select count(*) from public.comment_likes l where l.comment_id = b.id)::integer as likes,
             exists (select 1 from public.comment_likes l where l.comment_id = b.id and l.user_id = v_uid) as liked
        from base b
        left join nums n on n.author_id = b.author_id
       where b.moderation = 'visible'
          -- 지운·숨긴 원댓글도 보이는 답글이 있으면 자리를 남긴다
          or (b.parent_id is null
              and exists (select 1 from base r where r.parent_id = b.id and r.moderation = 'visible'))
       order by b.created_at
       limit 300
    ),
    j as (
      select id, parent_id, likes, created_at, moderation,
             jsonb_build_object(
               'id', id, 'parent_id', parent_id,
               'deleted', moderation <> 'visible',
               'body', case when moderation = 'visible' then body else '' end,
               'author', case when moderation = 'visible' then author else '' end,
               'side', case when moderation = 'visible' then side end,
               'mine', moderation = 'visible' and author_id is not distinct from v_uid,
               'likes', likes, 'liked', liked, 'created_at', created_at) as obj
        from shown
    )
    select jsonb_build_object(
      'best', (select coalesce(jsonb_agg(obj order by likes desc, created_at), '[]'::jsonb)
                 from (select * from j where moderation = 'visible' and likes >= v_best_min
                        order by likes desc, created_at limit 3) b),
      'all', (select coalesce(jsonb_agg(
                       t.obj || jsonb_build_object('replies',
                         (select coalesce(jsonb_agg(r.obj order by r.created_at), '[]'::jsonb)
                            from j r where r.parent_id = t.id and r.moderation = 'visible'))
                       order by t.created_at), '[]'::jsonb)
                from j t where t.parent_id is null)
    )
  );
end;
$$;
