-- 커뮤니티 주간 베스트 (2026-11-01)
--
-- 커뮤니티 "인기순"은 전체 기간 투표+댓글이라 오래된 글이 계속 위에 남는다.
-- 최근 weekly_best_days일 안에 올라온 글 중 반응(투표 + 보이는 댓글)이 많은 글 weekly_best_count개를 따로 보여 준다.
-- 반응이 weekly_best_min보다 적은 글은 넣지 않는다 (반응 없는 글이 "베스트"로 보이지 않게).
-- 설문 홍보 글도 포함하되, 목록(get_feed)과 같게 마감된 설문의 홍보 글은 뺀다. 포인트 보상 없음.

insert into public.point_rules (key, value, description) values
  ('weekly_best_days',  7, '주간 베스트: 최근 이 날짜 안에 올라온 글'),
  ('weekly_best_count', 3, '주간 베스트: 보여 줄 글 수'),
  ('weekly_best_min',   3, '주간 베스트: 투표 + 댓글이 이만큼은 있어야 들어감');

-- [{ id, kind, question, votes, comment_count }] (작성자 정보 없음)
create function public.get_weekly_best()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  with scored as (
    select p.id, p.kind, p.question, p.created_at,
           (select count(*) from public.post_votes v where v.post_id = p.id)::integer as votes,
           (select count(*) from public.comments c
             where c.target_type = 'post' and c.target_id = p.id and c.moderation = 'visible')::integer as comment_count
      from public.posts p
     where p.moderation = 'visible'
       and p.created_at >= now() - make_interval(days => public.point_rule('weekly_best_days')::integer)
       and (p.kind <> 'promo' or public.promo_survey_open(p.survey_id))
  ),
  top as (
    select * from scored
     where votes + comment_count >= public.point_rule('weekly_best_min')
     order by votes + comment_count desc, created_at desc
     limit public.point_rule('weekly_best_count')::integer
  )
  select coalesce(jsonb_agg(
           jsonb_build_object('id', id, 'kind', kind, 'question', question,
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
