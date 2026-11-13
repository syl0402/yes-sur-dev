-- 2026-11-14 커뮤니티 시안: 월드컵 카드에 "지금 순위 1~3위" 미리보기 + 댓글 수
-- get_worldcups 한 줄에 comment_count, top 추가 (나머지는 그대로)
--   top: [{ name, rate }] 우승 비율 순 3개. 결과 화면 랭킹과 같은 순서·같은 숫자(우승 비율 %)
--   참여가 result_min_count 미만이면 빈 배열 (적은 인원으로 순위를 보여 주지 않음)
-- 누가 무엇을 골랐는지는 없음 (후보 이름과 비율만)

create or replace function public.get_worldcups()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_min numeric := public.point_rule('result_min_count');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  return (
    select coalesce(jsonb_agg(
             jsonb_build_object(
               'id', w.id, 'title', w.title, 'size', w.size,
               'plays', pc.plays,
               'played', exists (select 1 from public.worldcup_plays p where p.worldcup_id = w.id and p.user_id = v_uid),
               'comment_count', (select count(*) from public.comments c
                                  where c.target_type = 'worldcup' and c.target_id = w.id and c.moderation = 'visible')::integer,
               'top', case when pc.plays >= v_min then (
                 select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'rate', t.rate) order by t.k), '[]'::jsonb)
                   from (
                     select s.name,
                            round(s.wins * 100.0 / pc.plays)::integer as rate,
                            row_number() over (order by s.wins desc,
                                                        case when s.mw + s.ml > 0 then s.mw::numeric / (s.mw + s.ml) else 0 end desc,
                                                        s.sort_order) as k
                       from (
                         select c.name, c.sort_order,
                                (select count(*) from public.worldcup_plays p where p.worldcup_id = w.id and p.winner_id = c.id) as wins,
                                (select count(*) from public.worldcup_matches m join public.worldcup_plays p on p.id = m.play_id
                                  where p.worldcup_id = w.id and m.winner_id = c.id) as mw,
                                (select count(*) from public.worldcup_matches m join public.worldcup_plays p on p.id = m.play_id
                                  where p.worldcup_id = w.id and m.loser_id = c.id) as ml
                           from public.worldcup_candidates c
                          where c.worldcup_id = w.id
                       ) s
                   ) t
                  where t.k <= 3
               ) else '[]'::jsonb end
             ) order by w.created_at desc, w.id desc), '[]'::jsonb)
      from public.worldcups w
      cross join lateral (select count(*)::integer as plays from public.worldcup_plays p where p.worldcup_id = w.id) pc
  );
end;
$$;
