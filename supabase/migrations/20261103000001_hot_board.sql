-- 커뮤니티 HOT 게시판 (2026-11-03)
--
-- 주간 베스트(20261101000001)를 HOT 게시판으로 넓힌다: 글뿐 아니라 월드컵도 들어간다.
-- 글: 지금과 같음 (최근 weekly_best_days일 안에 올라온 글, 투표 + 보이는 댓글, 마감된 설문의 홍보 글은 뺌)
-- 월드컵: 오래 열려 있으므로 "만든 날"이 아니라 최근 weekly_best_days일 안의 참여 + 보이는 댓글 수로 센다
-- 점수가 weekly_best_min 이상인 것만, 높은 순(같으면 최신) weekly_best_count개. 포인트 보상 없음.

update public.point_rules
   set value = 5, description = 'HOT 게시판: 보여 줄 글·월드컵 수'
 where key = 'weekly_best_count';

-- [{ type: 'post'|'worldcup', id, kind, question, votes, comment_count }] (작성자 정보 없음)
-- 월드컵은 kind = 'worldcup', question = 제목, votes = 최근 참여 수
create or replace function public.get_weekly_best()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_since timestamptz;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  v_since := now() - make_interval(days => public.point_rule('weekly_best_days')::integer);

  with scored as (
    select 'post' as type, p.id, p.kind::text as kind, p.question, p.created_at,
           (select count(*) from public.post_votes v where v.post_id = p.id)::integer as votes,
           (select count(*) from public.comments c
             where c.target_type = 'post' and c.target_id = p.id and c.moderation = 'visible')::integer as comment_count
      from public.posts p
     where p.moderation = 'visible'
       and p.created_at >= v_since
       and (p.kind <> 'promo' or public.promo_survey_open(p.survey_id))
    union all
    select 'worldcup', w.id, 'worldcup', w.title, w.created_at,
           (select count(*) from public.worldcup_plays pl
             where pl.worldcup_id = w.id and pl.created_at >= v_since)::integer,
           (select count(*) from public.comments c
             where c.target_type = 'worldcup' and c.target_id = w.id and c.moderation = 'visible'
               and c.created_at >= v_since)::integer
      from public.worldcups w
  ),
  top as (
    select * from scored
     where votes + comment_count >= public.point_rule('weekly_best_min')
     order by votes + comment_count desc, created_at desc
     limit public.point_rule('weekly_best_count')::integer
  )
  select coalesce(jsonb_agg(
           jsonb_build_object('type', type, 'id', id, 'kind', kind, 'question', question,
                              'votes', votes, 'comment_count', comment_count)
           order by votes + comment_count desc, created_at desc
         ), '[]'::jsonb)
    into v_result
    from top;

  return v_result;
end;
$$;

revoke execute on function public.get_weekly_best() from public, anon;
grant execute on function public.get_weekly_best() to authenticated;
