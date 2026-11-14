-- 2026-11-14 커뮤니티 결과 공유 이미지: 월드컵 결과에 "내 1위"(my_winner, 내 첫 판 우승 후보 id) 추가
-- 결과 화면에 다시 들어와도 공유 카드에 내 1위를 넣을 수 있게. 본인 것만 보낸다 (다른 사람이 무엇을 골랐는지는 없음)
-- 나머지는 20261101000002와 같음

create or replace function public.get_worldcup_result(p_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_plays integer;
  v_min numeric := public.point_rule('result_min_count');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.worldcups where id = p_id) then
    raise exception 'worldcup_not_found';
  end if;
  if not exists (select 1 from public.worldcup_plays where worldcup_id = p_id and user_id = v_uid) then
    raise exception 'not_played';
  end if;

  select count(*) into v_plays from public.worldcup_plays where worldcup_id = p_id;

  return jsonb_build_object(
    'plays', v_plays,
    -- 내가 첫 판에서 우승으로 고른 후보 (본인 것만, 공유 이미지용)
    'my_winner', (select winner_id from public.worldcup_plays where worldcup_id = p_id and user_id = v_uid limit 1),
    'ranking', (
      with s as (
        select c.id, c.name, c.sort_order,
               (select count(*) from public.worldcup_plays p where p.worldcup_id = p_id and p.winner_id = c.id)::integer as wins,
               (select count(*) from public.worldcup_matches m join public.worldcup_plays p on p.id = m.play_id
                 where p.worldcup_id = p_id and m.winner_id = c.id)::integer as mw,
               (select count(*) from public.worldcup_matches m join public.worldcup_plays p on p.id = m.play_id
                 where p.worldcup_id = p_id and m.loser_id = c.id)::integer as ml
          from public.worldcup_candidates c
         where c.worldcup_id = p_id
      )
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'id', id, 'name', name, 'wins', wins,
                 'win_rate', case when v_plays > 0 then round(wins * 100.0 / v_plays) else 0 end,
                 'match_wins', mw, 'match_losses', ml,
                 'match_rate', case when mw + ml > 0 then round(mw * 100.0 / (mw + ml)) else 0 end
               )
               order by wins desc,
                        case when mw + ml > 0 then mw::numeric / (mw + ml) else 0 end desc,
                        sort_order), '[]'::jsonb)
        from s
    ),
    'groups', (
      with g as (
        select 'major' as dim, coalesce(grp_major, '미입력') as label, winner_id
          from public.worldcup_plays where worldcup_id = p_id
        union all
        select 'gender', coalesce(grp_gender, '선택 안 함·미입력'), winner_id
          from public.worldcup_plays where worldcup_id = p_id
      ),
      n as (
        select dim, label, count(*)::integer as n from g group by dim, label
      ),
      top as (
        select distinct on (dim, label) dim, label, winner_id
          from (select dim, label, winner_id, count(*) as k from g group by dim, label, winner_id) t
         order by dim, label, k desc, winner_id
      )
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'dim', n.dim, 'label', n.label,
                 'hidden', n.n < v_min,
                 'n', case when n.n < v_min then null else n.n end,
                 'top', case when n.n >= v_min then (select name from public.worldcup_candidates where id = t.winner_id) end
               ) order by n.dim, n.n desc, n.label), '[]'::jsonb)
        from n join top t on t.dim = n.dim and t.label = n.label
       where n.label <> '미입력'
    )
  );
end;
$$;
