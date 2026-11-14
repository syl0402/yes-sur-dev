-- 2026-11-14 마이 탭 시안 ⑥: 내 커뮤니티 "참여" 목록 (내가 투표한 글 · 답한 오늘의 질문 · 한 월드컵)
-- get_my_participation() → [{ type, id, kind, title, choice, created_at }] 최신순 200개
--   type: post · daily · worldcup / kind: 글 종류(balance·relate·pick, 그 밖엔 null) / choice: 내가 고른 답 글자
--   본인 것만 (auth.uid()). 숨겨진 글은 뺀다. 다른 사람이 무엇을 골랐는지는 없음

create or replace function public.get_my_participation()
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
  return (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb)
      from (
        select * from (
          select 'post' as type, p.id, p.kind, p.question as title,
                 p.options[v.choice + 1] as choice, v.created_at
            from public.post_votes v
            join public.posts p on p.id = v.post_id
           where v.user_id = v_uid and p.moderation = 'visible'
          union all
          select 'daily', q.id, null, q.question,
                 case when a.choice = 'a' then q.option_a else q.option_b end, a.created_at
            from public.daily_answers a
            join public.daily_questions q on q.id = a.question_id
           where a.user_id = v_uid
          union all
          select 'worldcup', w.id, null, w.title, c.name, pl.created_at
            from public.worldcup_plays pl
            join public.worldcups w on w.id = pl.worldcup_id
            join public.worldcup_candidates c on c.id = pl.winner_id
           where pl.user_id = v_uid
        ) u
        order by created_at desc
        limit 200
      ) t
  );
end;
$$;

revoke execute on function public.get_my_participation() from public, anon;
grant execute on function public.get_my_participation() to authenticated;
