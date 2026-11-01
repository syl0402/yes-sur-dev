-- 커뮤니티 OOO 월드컵 · F-608 (2026-11-01)
--
-- 이상형 월드컵 방식: 후보 8개 또는 16개 중 둘씩 골라 우승 하나를 뽑는다.
-- 지금은 운영자가 SQL로 등록하는 공식 월드컵만 (supabase/seed/worldcups.sql). 사용자 제작은 출시 후.
-- 집계: 한 사람의 첫 판만 (worldcup_plays의 (worldcup_id, user_id) 고유). 다시 하기는 앱에서만, 저장·포인트 없음.
-- 포인트: 학생이 처음 끝냈을 때 community_vote, 커뮤니티 하루 합산 community_daily_cap 안에서 (vote_post와 같은 계산).
-- 결과: 우승 비율 + 1:1 승률 + 계열별·성별 1위 (result_min_count 미만 그룹 숨김). 한 판 끝낸 뒤에만 보인다.
-- 표는 모두 서버 함수로만 읽고 쓴다 (앱 권한 없음).

-- =========================================================
-- 1. 표
-- =========================================================
create table public.worldcups (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 50),
  description text check (char_length(description) <= 200),
  size integer not null check (size in (8, 16)),
  created_at timestamptz not null default now()
);

create table public.worldcup_candidates (
  id bigint generated always as identity primary key,
  worldcup_id bigint not null references public.worldcups (id) on delete cascade,
  sort_order integer not null,
  name text not null check (char_length(name) between 1 and 30),
  unique (worldcup_id, sort_order)
);

create table public.worldcup_plays (
  id bigint generated always as identity primary key,
  worldcup_id bigint not null references public.worldcups (id) on delete cascade,
  -- 탈퇴하면 결과는 통계로 남기고 사람만 비운다
  user_id uuid references public.profiles (id) on delete set null,
  winner_id bigint not null references public.worldcup_candidates (id) on delete cascade,
  -- 그 순간의 그룹 (응답과 같은 fill_response_groups 트리거로 채움)
  grp_major text,
  grp_grade text,
  grp_gender text,
  grp_age text,
  created_at timestamptz not null default now(),
  -- 한 사람은 월드컵마다 한 번만 집계
  unique (worldcup_id, user_id)
);

create table public.worldcup_matches (
  id bigint generated always as identity primary key,
  play_id bigint not null references public.worldcup_plays (id) on delete cascade,
  winner_id bigint not null references public.worldcup_candidates (id) on delete cascade,
  loser_id bigint not null references public.worldcup_candidates (id) on delete cascade
);

create index worldcup_plays_worldcup_idx on public.worldcup_plays (worldcup_id);
create index worldcup_matches_play_idx on public.worldcup_matches (play_id);

alter table public.worldcups enable row level security;
alter table public.worldcup_candidates enable row level security;
alter table public.worldcup_plays enable row level security;
alter table public.worldcup_matches enable row level security;
revoke all on public.worldcups, public.worldcup_candidates, public.worldcup_plays, public.worldcup_matches
  from anon, authenticated;

create trigger worldcup_plays_fill_groups
  before insert on public.worldcup_plays
  for each row execute function public.fill_response_groups();

-- =========================================================
-- 2. 댓글: 월드컵에도 단다 (기존 get_comments·create_comment·댓글 신고 그대로)
-- =========================================================
alter table public.comments drop constraint comments_target_type_check;
alter table public.comments add constraint comments_target_type_check
  check (target_type in ('post', 'daily', 'worldcup'));

create or replace function public.comment_target_ok(p_type text, p_id bigint)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case p_type
           when 'post' then exists (select 1 from public.posts where id = p_id and moderation = 'visible')
           when 'daily' then exists (select 1 from public.daily_questions
                                      where id = p_id and day = (now() at time zone 'Asia/Seoul')::date)
           when 'worldcup' then exists (select 1 from public.worldcups where id = p_id)
           else false
         end;
$$;

-- =========================================================
-- 3. get_worldcups: 목록 (최신순) [{ id, title, size, plays, played }]
-- =========================================================
create function public.get_worldcups()
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
    select coalesce(jsonb_agg(
             jsonb_build_object(
               'id', w.id, 'title', w.title, 'size', w.size,
               'plays', (select count(*) from public.worldcup_plays p where p.worldcup_id = w.id),
               'played', exists (select 1 from public.worldcup_plays p where p.worldcup_id = w.id and p.user_id = v_uid)
             ) order by w.created_at desc, w.id desc), '[]'::jsonb)
      from public.worldcups w
  );
end;
$$;

-- =========================================================
-- 4. get_worldcup: 하나 (후보 포함) { id, title, description, size, played, candidates: [{id, name}] }
-- =========================================================
create function public.get_worldcup(p_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select jsonb_build_object(
           'id', w.id, 'title', w.title, 'description', w.description, 'size', w.size,
           'played', exists (select 1 from public.worldcup_plays p where p.worldcup_id = w.id and p.user_id = v_uid),
           'candidates', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.sort_order), '[]'::jsonb)
                            from public.worldcup_candidates c where c.worldcup_id = w.id)
         )
    into v_result
    from public.worldcups w
   where w.id = p_id;
  if v_result is null then
    raise exception 'worldcup_not_found';
  end if;
  return v_result;
end;
$$;

-- =========================================================
-- 5. submit_worldcup: 한 판 결과 저장 (첫 판만) + 포인트
-- p_matches: [{ "winner": 후보id, "loser": 후보id }, …] 진행한 순서대로
-- 검사: 매치 수 = size-1 · 모두 이 월드컵 후보 · 진 후보는 다시 안 나옴 · 후보마다 매치 수 ≤ log2(size) · 안 진 후보 1명 = 우승
-- 돌려줌: { reward }
-- =========================================================
create function public.submit_worldcup(p_id bigint, p_matches jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_student boolean;
  v_size integer;
  v_rounds integer;
  v_m jsonb;
  v_w bigint;
  v_l bigint;
  v_out bigint[] := '{}';
  v_count jsonb := '{}';
  v_winner bigint;
  v_play bigint;
  v_today integer;
  v_reward integer := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  -- 회원정보 행을 잠근다: 동시에 여러 번 보내도 하루 상한·1회를 넘지 않게
  select account_type = 'student' into v_student from public.profiles where id = v_uid for update;

  select size into v_size from public.worldcups where id = p_id;
  if v_size is null then
    raise exception 'worldcup_not_found';
  end if;
  if exists (select 1 from public.worldcup_plays where worldcup_id = p_id and user_id = v_uid) then
    raise exception 'already_played';
  end if;

  -- 대진 검사
  if jsonb_typeof(p_matches) <> 'array' or jsonb_array_length(p_matches) <> v_size - 1 then
    raise exception 'invalid_bracket';
  end if;
  v_rounds := case v_size when 8 then 3 else 4 end;
  for v_m in select * from jsonb_array_elements(p_matches) loop
    v_w := (v_m->>'winner')::bigint;
    v_l := (v_m->>'loser')::bigint;
    if v_w is null or v_l is null or v_w = v_l
       or v_w = any (v_out) or v_l = any (v_out)
       or (select count(*) from public.worldcup_candidates where worldcup_id = p_id and id in (v_w, v_l)) <> 2 then
      raise exception 'invalid_bracket';
    end if;
    v_out := v_out || v_l;
    v_count := jsonb_set(v_count, array[v_w::text], to_jsonb(coalesce((v_count->>v_w::text)::integer, 0) + 1));
    v_count := jsonb_set(v_count, array[v_l::text], to_jsonb(coalesce((v_count->>v_l::text)::integer, 0) + 1));
    if (v_count->>v_w::text)::integer > v_rounds then
      raise exception 'invalid_bracket';
    end if;
  end loop;
  -- 끝까지 안 진 후보 = 우승 (모든 후보가 한 번씩 나왔어야 함)
  select c.id into v_winner from public.worldcup_candidates c
   where c.worldcup_id = p_id and not (c.id = any (v_out));
  if (select count(*) from public.worldcup_candidates where worldcup_id = p_id) <> v_size
     or cardinality(v_out) <> v_size - 1 or v_winner is null then
    raise exception 'invalid_bracket';
  end if;

  -- 저장
  begin
    insert into public.worldcup_plays (worldcup_id, user_id, winner_id) values (p_id, v_uid, v_winner)
    returning id into v_play;
  exception when unique_violation then
    raise exception 'already_played';
  end;
  insert into public.worldcup_matches (play_id, winner_id, loser_id)
  select v_play, (m->>'winner')::bigint, (m->>'loser')::bigint from jsonb_array_elements(p_matches) m;

  -- 포인트: 학생만, 커뮤니티 하루 합산 상한 안에서 (ref 고유 → 중복 지급 불가)
  if v_student then
    select coalesce(sum(amount), 0)::integer into v_today
      from public.point_ledger
     where user_id = v_uid and reason = 'community' and created_at >= public.kst_day_start();
    v_reward := least(public.point_rule('community_vote')::integer,
                      public.point_rule('community_daily_cap')::integer - v_today);
    if v_reward > 0 then
      insert into public.point_ledger (user_id, amount, status, reason, ref_id)
      values (v_uid, v_reward, 'confirmed', 'community', 'worldcup:' || p_id);
    else
      v_reward := 0;
    end if;
  end if;

  return jsonb_build_object('reward', v_reward);
end;
$$;

-- =========================================================
-- 6. get_worldcup_result: 랭킹 (내가 한 판 끝낸 뒤에만)
-- { plays, ranking: [{ id, name, wins, win_rate, match_wins, match_losses, match_rate }],
--   groups: [{ dim, label, hidden, n, top }] }  — 누가 무엇을 골랐는지는 없음
-- =========================================================
create function public.get_worldcup_result(p_id bigint)
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

-- =========================================================
-- 권한
-- =========================================================
revoke execute on function public.get_worldcups() from public, anon;
revoke execute on function public.get_worldcup(bigint) from public, anon;
revoke execute on function public.submit_worldcup(bigint, jsonb) from public, anon;
revoke execute on function public.get_worldcup_result(bigint) from public, anon;

grant execute on function public.get_worldcups() to authenticated;
grant execute on function public.get_worldcup(bigint) to authenticated;
grant execute on function public.submit_worldcup(bigint, jsonb) to authenticated;
grant execute on function public.get_worldcup_result(bigint) to authenticated;
