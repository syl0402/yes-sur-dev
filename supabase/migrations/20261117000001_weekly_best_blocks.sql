-- 2026-11-17 이번 주 HOT(커뮤니티 롤링·홈 인기 투표)에서도 내가 차단한 사람의 글을 뺀다 (커뮤니티 ④ 사용자 차단)
-- · 투표 수 = 투표한 사람 수 (일반 글 여러 개 고르기로 한 사람이 여러 줄일 수 있어서)
-- 나머지는 20261110000008_weekly_best_created_at.sql 그대로

create or replace function public.get_weekly_best()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_since timestamptz;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  v_since := now() - make_interval(days => public.point_rule('weekly_best_days')::integer);

  with scored as (
    select 'post' as type, p.id, p.kind::text as kind, p.question, p.created_at,
           (select count(distinct v.user_id) from public.post_votes v where v.post_id = p.id)::integer as votes,
           (select count(*) from public.comments c
             where c.target_type = 'post' and c.target_id = p.id and c.moderation = 'visible')::integer as comment_count
      from public.posts p
     where p.moderation = 'visible'
       and p.created_at >= v_since
       and (p.kind <> 'promo' or public.promo_survey_open(p.survey_id))
       and not public.is_blocked_by(v_uid, p.author_id)
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
