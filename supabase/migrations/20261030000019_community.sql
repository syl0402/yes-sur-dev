-- 커뮤니티 1단계: 투표 3종 (2026-10-30)
--
-- 글(posts) 하나에 종류(kind)로 여러 놀이를 담는다. 지금은 투표 3종:
--   balance 밸런스 (A vs B) · relate 나만 그래? (나도 그래 / 나는 아냐) · pick 골라 줘 (보기 2~4개)
-- 나중에 promo(설문 홍보), free(자유 게시판)도 같은 표에 (2단계부터 kind를 늘린다)
-- 회원이 직접 만들고, 신고로 숨긴다 (moderation, 신고 확장은 2단계)
-- 투표 시점의 계열·학년·성별·나이대를 저장해 "공대 63% vs 인문 41%" 같은 비교를 한다 (5명 미만 그룹 숨김)
-- 포인트: 투표 1번 community_vote, 커뮤니티 합산 하루 community_daily_cap (한국 날짜),
--         내 글 투표 creator_bonus_every개마다 만든 사람 creator_bonus. 내 글에 투표하면 포인트 없음
-- 앱은 표를 직접 읽지 않는다 (작성자·투표자 보호). 모두 서버 함수로

-- =========================================================
-- 1. 설정값 · 포인트 기록 이유
-- =========================================================
insert into public.point_rules (key, value, description) values
  ('community_vote',      2,  '커뮤니티 투표 1번 포인트'),
  ('community_daily_cap', 20, '커뮤니티 활동 포인트 하루 합산 최대'),
  ('creator_bonus_every', 50, '내 글에 투표가 이만큼 모일 때마다 만든 사람 보너스'),
  ('creator_bonus',       10, '만든 사람 보너스 포인트'),
  ('post_daily_max',      5,  '커뮤니티 글 하루 최대 개수 (도배 방지)');

alter table public.point_ledger drop constraint point_ledger_reason_check;
alter table public.point_ledger add constraint point_ledger_reason_check
  check (reason in ('welcome', 'survey_reward', 'survey_create', 'survey_refund',
                    'data_view', 'data_share', 'balance_vote', 'daily_question', 'streak_bonus',
                    'community', 'creator_bonus'));

-- =========================================================
-- 2. 표
-- =========================================================
create table public.posts (
  id bigint generated always as identity primary key,
  -- 탈퇴하면 글은 남기고 작성자만 비운다 ("탈퇴한 회원")
  author_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('balance', 'relate', 'pick')),
  question text not null check (char_length(question) between 1 and 100),
  options text[] not null check (cardinality(options) between 2 and 4),
  moderation text not null default 'visible' check (moderation in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default now()
);

create index posts_created_at_idx on public.posts (created_at desc);

create table public.post_votes (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  -- 고른 보기 순서 (0부터)
  choice smallint not null check (choice between 0 and 3),
  grp_major text,
  grp_grade text,
  grp_gender text,
  grp_age text,
  created_at timestamptz not null default now(),
  -- 한 사람이 한 글에 한 표 (연타해도 포인트 한 번)
  unique (post_id, user_id)
);

create index post_votes_post_idx on public.post_votes (post_id);

-- 투표 시점의 그룹 저장 (설문 응답과 같은 함수, 20261030000015)
create trigger post_votes_fill_groups
  before insert on public.post_votes
  for each row execute function public.fill_response_groups();

-- 앱은 직접 읽지 않는다: RLS만 켜고 정책·권한 없음 (아래 서버 함수로만)
alter table public.posts enable row level security;
alter table public.post_votes enable row level security;
revoke all on public.posts, public.post_votes from anon, authenticated;

-- =========================================================
-- 3. 도우미
-- =========================================================

-- 한국 날짜로 오늘 0시 (하루 제한·하루 상한 계산용)
create function public.kst_day_start()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
$$;

-- 커뮤니티에 보이는 이름: 운영자 "옛썰 공식", 단체 = 단체 이름, 학생 = 닉네임, 탈퇴 = "탈퇴한 회원"
create function public.display_name(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select case
              when p.role = 'admin' then '옛썰 공식'
              when p.account_type = 'org' then coalesce(o.name, '단체')
              else p.nickname
            end
       from public.profiles p
       left join public.organizations o on o.id = p.id
      where p.id = p_uid),
    '탈퇴한 회원');
$$;

-- 보기별 표 수: [3, 5] 처럼 보기 순서대로
create function public.post_counts(p_post_id bigint, p_n integer)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(
           (select count(*) from public.post_votes v where v.post_id = p_post_id and v.choice = i)
           order by i), '[]'::jsonb)
    from generate_series(0, p_n - 1) i;
$$;

-- 한 기준으로 나눈 그룹별 표 수. 인원이 result_min_count 미만이면 숫자 없이 숨김
create function public.post_groups(p_post_id bigint, p_dim text, p_n integer)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with v as (
    select coalesce(case p_dim
                      when 'major' then grp_major
                      when 'grade' then grp_grade
                      when 'gender' then grp_gender
                      else grp_age
                    end, '미입력') as grp,
           choice
      from public.post_votes
     where post_id = p_post_id
  ),
  g as (
    select grp, count(*)::integer as n from v group by grp
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'label', g.grp,
             'hidden', g.n < public.point_rule('result_min_count'),
             'n', case when g.n < public.point_rule('result_min_count') then null else g.n end,
             'counts', case when g.n >= public.point_rule('result_min_count') then (
               select jsonb_agg((select count(*) from v v2 where v2.grp = g.grp and v2.choice = i) order by i)
                 from generate_series(0, p_n - 1) i) end
           ) order by g.grp), '[]'::jsonb)
    from g;
$$;

revoke execute on function public.kst_day_start() from public, anon, authenticated;
revoke execute on function public.display_name(uuid) from public, anon, authenticated;
revoke execute on function public.post_counts(bigint, integer) from public, anon, authenticated;
revoke execute on function public.post_groups(bigint, text, integer) from public, anon, authenticated;

-- =========================================================
-- 4. create_post: 글 만들기 → 글 번호
-- =========================================================
create function public.create_post(p_kind text, p_question text, p_options text[] default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_question text := btrim(coalesce(p_question, ''));
  v_options text[];
  v_opt text;
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_kind is null or p_kind not in ('balance', 'relate', 'pick') then
    raise exception 'invalid_post';
  end if;
  if char_length(v_question) not between 1 and 100 then
    raise exception 'invalid_post';
  end if;

  if p_kind = 'relate' then
    v_options := array['나도 그래', '나는 아냐'];
  else
    v_options := '{}';
    foreach v_opt in array coalesce(p_options, '{}') loop
      v_opt := btrim(coalesce(v_opt, ''));
      if char_length(v_opt) not between 1 and 30 then
        raise exception 'invalid_post';
      end if;
      if v_opt = any (v_options) then
        raise exception 'invalid_post';
      end if;
      v_options := v_options || v_opt;
    end loop;
    if (p_kind = 'balance' and cardinality(v_options) <> 2)
       or (p_kind = 'pick' and cardinality(v_options) not between 2 and 4) then
      raise exception 'invalid_post';
    end if;
  end if;

  -- 같은 사람이 동시에 여러 개 올려도 하루 개수를 넘지 않게
  perform 1 from public.profiles where id = v_uid for update;
  if (select count(*) from public.posts where author_id = v_uid and created_at >= public.kst_day_start())
     >= public.point_rule('post_daily_max') then
    raise exception 'post_limit';
  end if;

  insert into public.posts (author_id, kind, question, options)
  values (v_uid, p_kind, v_question, v_options)
  returning id into v_id;
  return v_id;
end;
$$;

-- =========================================================
-- 5. vote_post: 투표 → { reward }
-- =========================================================
create function public.vote_post(p_post_id bigint, p_choice integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_post public.posts%rowtype;
  v_student boolean;
  v_today integer;
  v_reward integer := 0;
  v_votes integer;
  v_every integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  -- 회원정보 행을 잠근다: 동시에 여러 글에 투표해도 하루 상한을 넘지 않게
  select account_type = 'student' into v_student from public.profiles where id = v_uid for update;

  select * into v_post from public.posts where id = p_post_id and moderation = 'visible';
  if not found then
    raise exception 'post_not_found';
  end if;
  if p_choice is null or p_choice < 0 or p_choice >= cardinality(v_post.options) then
    raise exception 'invalid_choice';
  end if;

  begin
    insert into public.post_votes (post_id, user_id, choice) values (p_post_id, v_uid, p_choice);
  exception when unique_violation then
    raise exception 'already_voted';
  end;

  -- 투표한 사람: 학생이고 내 글이 아닐 때, 하루 합산 상한 안에서
  if v_student and v_post.author_id is distinct from v_uid then
    select coalesce(sum(amount), 0)::integer into v_today
      from public.point_ledger
     where user_id = v_uid and reason = 'community' and created_at >= public.kst_day_start();
    v_reward := least(public.point_rule('community_vote')::integer,
                      public.point_rule('community_daily_cap')::integer - v_today);
    if v_reward > 0 then
      insert into public.point_ledger (user_id, amount, status, reason, ref_id)
      values (v_uid, v_reward, 'confirmed', 'community', 'post:' || p_post_id);
    else
      v_reward := 0;
    end if;
  end if;

  -- 만든 사람: 투표가 n개 모일 때마다 (학생 작성자만, 내 투표는 세지 않음)
  v_every := public.point_rule('creator_bonus_every')::integer;
  if v_post.author_id is not null and v_post.author_id is distinct from v_uid and v_every > 0
     and exists (select 1 from public.profiles where id = v_post.author_id and account_type = 'student') then
    select count(*) into v_votes from public.post_votes
     where post_id = p_post_id and user_id is distinct from v_post.author_id;
    if v_votes % v_every = 0 then
      insert into public.point_ledger (user_id, amount, status, reason, ref_id)
      values (v_post.author_id, public.point_rule('creator_bonus')::integer, 'confirmed', 'creator_bonus',
              'post:' || p_post_id || ':' || v_votes);
    end if;
  end if;

  return jsonb_build_object('reward', v_reward);
end;
$$;

-- =========================================================
-- 6. get_feed: 글 목록 (숨긴 글 제외)
-- [{ id, kind, question, options, author, mine, created_at, votes, my_choice, counts(투표했거나 내 글이면) }]
-- p_sort: popular(투표 많은 순) / latest
-- =========================================================
create function public.get_feed(p_kind text default null, p_sort text default 'popular')
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

  with rows as (
    select p.*,
           (select count(*) from public.post_votes v where v.post_id = p.id)::integer as votes,
           (select v.choice from public.post_votes v where v.post_id = p.id and v.user_id = v_uid) as my_choice
      from public.posts p
     where p.moderation = 'visible'
       and (p_kind is null or p.kind = p_kind)
     order by
       case when coalesce(p_sort, 'popular') = 'popular'
            then (select count(*) from public.post_votes v where v.post_id = p.id) end desc nulls last,
       p.created_at desc
     limit 50
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', id, 'kind', kind, 'question', question, 'options', to_jsonb(options),
             'author', public.display_name(author_id),
             'mine', author_id is not distinct from v_uid,
             'created_at', created_at, 'votes', votes, 'my_choice', my_choice,
             'counts', case when my_choice is not null or author_id is not distinct from v_uid
                            then public.post_counts(id, cardinality(options)) end
           )
           order by case when coalesce(p_sort, 'popular') = 'popular' then votes end desc nulls last,
                    created_at desc), '[]'::jsonb)
    into v_result
    from rows;
  return v_result;
end;
$$;

-- =========================================================
-- 7. get_post: 글 하나 + (투표했거나 내 글이면) 비율과 계열·학년·성별·나이대 비교
-- =========================================================
create function public.get_post(p_post_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_post public.posts%rowtype;
  v_choice smallint;
  v_show boolean;
  v_n integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_post from public.posts where id = p_post_id;
  if not found or (v_post.moderation <> 'visible' and v_post.author_id is distinct from v_uid) then
    raise exception 'post_not_found';
  end if;
  select choice into v_choice from public.post_votes where post_id = p_post_id and user_id = v_uid;
  v_show := v_choice is not null or v_post.author_id is not distinct from v_uid;
  v_n := cardinality(v_post.options);

  return jsonb_build_object(
    'id', v_post.id, 'kind', v_post.kind, 'question', v_post.question, 'options', to_jsonb(v_post.options),
    'author', public.display_name(v_post.author_id),
    'mine', v_post.author_id is not distinct from v_uid,
    'moderation', v_post.moderation,
    'created_at', v_post.created_at,
    'votes', (select count(*) from public.post_votes where post_id = p_post_id),
    'my_choice', v_choice,
    'counts', case when v_show then public.post_counts(p_post_id, v_n) end,
    'groups', case when v_show then jsonb_build_object(
      'major',  public.post_groups(p_post_id, 'major', v_n),
      'grade',  public.post_groups(p_post_id, 'grade', v_n),
      'gender', public.post_groups(p_post_id, 'gender', v_n),
      'age',    public.post_groups(p_post_id, 'age', v_n)) end
  );
end;
$$;

revoke execute on function public.create_post(text, text, text[]) from public, anon;
revoke execute on function public.vote_post(bigint, integer) from public, anon;
revoke execute on function public.get_feed(text, text) from public, anon;
revoke execute on function public.get_post(bigint) from public, anon;
grant execute on function public.create_post(text, text, text[]) to authenticated;
grant execute on function public.vote_post(bigint, integer) to authenticated;
grant execute on function public.get_feed(text, text) to authenticated;
grant execute on function public.get_post(bigint) to authenticated;
