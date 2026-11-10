-- 이번 주 HOT 목록에 "올린 시각" 추가 (2026-11-10)
--
-- 홈 "취향 밸런스 인기 투표"에서 24시간 안에 올라온 글에 NEW를 붙이려고 created_at을 함께 돌려준다.
-- 고르는 기준·순서·권한은 20261103000001_hot_board.sql 그대로. 돌려주는 값에 created_at만 더함
-- (커뮤니티 탭 HOT 목록은 이 값을 쓰지 않으니 영향 없음)

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
                              'votes', votes, 'comment_count', comment_count, 'created_at', created_at)
           order by votes + comment_count desc, created_at desc
         ), '[]'::jsonb)
    into v_result
    from top;

  return v_result;
end;
$$;

revoke execute on function public.get_weekly_best() from public, anon;
grant execute on function public.get_weekly_best() to authenticated;
