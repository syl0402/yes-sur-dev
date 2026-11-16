-- 2026-11-16 커뮤니티 "일반 글" (11/21 2주차 업데이트, 사용자 결정)
-- · 일반 글(kind 'free'): 제목 + 본문(2,000자) + 사진 3장까지 + 투표(선택)
--   투표: 보기 2~10개 · 여러 개 고르기 가능 · 마감(없음/1일/3일/7일)
-- · 포인트 (사용자 결정): 일반 글 쓰기 0P (도배 방지) · 일반 투표 참여는 기존 커뮤니티 투표와 같은 규칙
--   (community_vote, 하루 상한 community_daily_cap, 만든 사람 creator_bonus_every — 모두 point_rules)
-- · 사진: 공개 저장소 content의 posts/<내 id>/ 에 본인만 올린다. 글이 신고로 숨겨지면 앱에서 사진도 안 보인다
-- · 사용자 차단 표(user_blocks)를 미리 만들고, 피드·글 하나에서 차단한 사람 글을 뺀다 (차단 버튼·댓글은 ④단계)
-- · 기존 버그 같이 고침: 골라 줘 보기 5개를 받게 해 놓고(20261114000004) 표 제한은 2~4개 그대로였다 → 2~5개
-- 투표 표: 한 사람이 같은 글·같은 보기에 한 번(unique post·user·choice)으로 바꾼다 (여러 개 고르기).
--   밸런스·공감·골라 줘는 vote_post가 "한 글에 한 표"를 직접 확인한다 (회원 행 잠금으로 연타에도 한 번)

-- =========================================================
-- 1. 글 표
-- =========================================================
alter table public.posts drop constraint posts_kind_check;
alter table public.posts add constraint posts_kind_check
  check (kind in ('balance', 'relate', 'pick', 'promo', 'free'));

alter table public.posts drop constraint posts_options_check;
alter table public.posts add constraint posts_options_check
  check ((kind = 'promo' and cardinality(options) = 0)
      or (kind = 'free' and (cardinality(options) = 0 or cardinality(options) between 2 and 10))
      or (kind in ('balance', 'relate', 'pick') and cardinality(options) between 2 and 5));

-- 본문: 일반 글은 2,000자 (다른 종류는 지금처럼 500자, create_post가 확인)
alter table public.posts drop constraint posts_body_check;
alter table public.posts add constraint posts_body_check check (char_length(body) <= 2000);

alter table public.posts add column images text[] not null default '{}' check (cardinality(images) <= 3);
alter table public.posts add column poll_multi boolean not null default false;
alter table public.posts add column poll_closes_at timestamptz;

-- =========================================================
-- 2. 투표 표: 여러 개 고르기
-- =========================================================
alter table public.post_votes drop constraint post_votes_post_id_user_id_key;
alter table public.post_votes add constraint post_votes_one_per_choice unique (post_id, user_id, choice);
alter table public.post_votes drop constraint post_votes_choice_check;
alter table public.post_votes add constraint post_votes_choice_check check (choice between 0 and 9);

-- =========================================================
-- 3. 사용자 차단 (함수·화면은 ④단계)
-- =========================================================
create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
-- 앱은 직접 읽지 않는다 (서버 함수로만)
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon, authenticated;

-- 내가 차단한 사람인지
create function public.is_blocked_by(p_viewer uuid, p_author uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_author is not null
     and exists (select 1 from public.user_blocks where blocker_id = p_viewer and blocked_id = p_author);
$$;
revoke execute on function public.is_blocked_by(uuid, uuid) from public, anon, authenticated;

-- =========================================================
-- 4. 사진 저장소: posts/<내 id>/ 에 본인만 올리고 지운다
-- =========================================================
create policy "공개 사진: 글 사진은 본인 폴더에만 올린다"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'content' and (storage.foldername(name))[1] = 'posts'
              and (storage.foldername(name))[2] = (select auth.uid())::text);

create policy "공개 사진: 글 사진은 본인 것만 지운다"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'content' and (storage.foldername(name))[1] = 'posts'
         and (storage.foldername(name))[2] = (select auth.uid())::text);

-- =========================================================
-- 5. 글 쓰기 (일반 글 추가. 나머지는 20261114000004와 같음)
-- =========================================================
drop function public.create_post(text, text, text[], text, boolean);
create function public.create_post(p_kind text, p_question text, p_options text[] default null, p_body text default null,
                                   p_anonymous boolean default true,
                                   p_images text[] default null, p_poll_multi boolean default false,
                                   p_poll_days integer default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_question text := btrim(coalesce(p_question, ''));
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_options text[];
  v_opt text;
  v_images text[] := coalesce(p_images, '{}');
  v_img text;
  v_closes timestamptz;
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_kind is null or p_kind not in ('balance', 'relate', 'pick', 'free') then
    raise exception 'invalid_post';
  end if;
  if char_length(v_question) not between 1 and 100 then
    raise exception 'invalid_post';
  end if;
  -- 본문: 일반 글은 꼭 쓰고 2,000자까지, 다른 종류는 500자까지
  if p_kind = 'free' then
    if v_body is null or char_length(v_body) > 2000 then
      raise exception 'invalid_post';
    end if;
  elsif char_length(coalesce(v_body, '')) > 500 then
    raise exception 'invalid_post';
  end if;
  -- 사진: 일반 글만, 3장까지, 내 폴더 경로만
  if cardinality(v_images) > 0 then
    if p_kind <> 'free' or cardinality(v_images) > 3 then
      raise exception 'invalid_post';
    end if;
    foreach v_img in array v_images loop
      if v_img is null or v_img not like 'posts/' || v_uid::text || '/%' or char_length(v_img) > 200 then
        raise exception 'invalid_image';
      end if;
    end loop;
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
       or (p_kind = 'pick' and cardinality(v_options) not between 2 and 5)
       or (p_kind = 'free' and cardinality(v_options) not in (0) and cardinality(v_options) not between 2 and 10) then
      raise exception 'invalid_post';
    end if;
  end if;

  -- 투표 마감: 일반 글 투표만 (없음 / 1·3·7일)
  if p_poll_days is not null then
    if p_kind <> 'free' or cardinality(v_options) = 0 or p_poll_days not in (1, 3, 7) then
      raise exception 'invalid_post';
    end if;
    v_closes := now() + make_interval(days => p_poll_days);
  end if;

  perform 1 from public.profiles where id = v_uid for update;
  if (select count(*) from public.posts where author_id = v_uid and created_at >= public.kst_day_start())
     >= public.point_rule('post_daily_max') then
    raise exception 'post_limit';
  end if;

  insert into public.posts (author_id, kind, question, options, body, anonymous, images, poll_multi, poll_closes_at)
  values (v_uid, p_kind, v_question, v_options, v_body,
          coalesce(p_anonymous, true) and public.can_post_anonymously(v_uid),
          v_images,
          p_kind = 'free' and cardinality(v_options) > 0 and coalesce(p_poll_multi, false),
          v_closes)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.create_post(text, text, text[], text, boolean, text[], boolean, integer) from public, anon;
grant execute on function public.create_post(text, text, text[], text, boolean, text[], boolean, integer) to authenticated;

-- =========================================================
-- 6. 투표: 한 글에 한 번 (보기는 한 개, 일반 글 여러 개 고르기면 여러 개) → { reward }
--    기존 vote_post(p_post_id, p_choice)는 그대로 두고, 일반 글은 p_choices를 받는 새 함수로
-- =========================================================
create or replace function public.vote_post(p_post_id bigint, p_choice integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.vote_post_multi(p_post_id, array[p_choice]);
end;
$$;

create function public.vote_post_multi(p_post_id bigint, p_choices integer[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_post public.posts%rowtype;
  v_student boolean;
  v_choices integer[];
  v_c integer;
  v_today integer;
  v_reward integer := 0;
  v_votes integer;
  v_every integer;
  v_bonus integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  -- 회원정보 행을 잠근다: 연타·여러 글 동시 투표에도 한 글에 한 번, 하루 상한을 넘지 않게
  select account_type = 'student' into v_student from public.profiles where id = v_uid for update;

  select * into v_post from public.posts where id = p_post_id and moderation = 'visible';
  if not found or v_post.kind = 'promo' or public.is_blocked_by(v_uid, v_post.author_id) then
    raise exception 'post_not_found';
  end if;
  if v_post.poll_closes_at is not null and v_post.poll_closes_at <= now() then
    raise exception 'poll_closed';
  end if;
  if exists (select 1 from public.post_votes where post_id = p_post_id and user_id = v_uid) then
    raise exception 'already_voted';
  end if;

  select array_agg(distinct c order by c) into v_choices from unnest(coalesce(p_choices, '{}')) c;
  if v_choices is null or cardinality(v_choices) = 0
     or (cardinality(v_choices) > 1 and not v_post.poll_multi) then
    raise exception 'invalid_choice';
  end if;
  foreach v_c in array v_choices loop
    if v_c is null or v_c < 0 or v_c >= cardinality(v_post.options) then
      raise exception 'invalid_choice';
    end if;
    insert into public.post_votes (post_id, user_id, choice) values (p_post_id, v_uid, v_c);
  end loop;

  -- 투표한 사람: 학생이고 내 글이 아닐 때, 하루 합산 상한 안에서 (글 하나에 한 번)
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

  -- 만든 사람: 투표한 사람이 n명 모일 때마다 (학생 작성자만, 내 투표는 세지 않음)
  v_every := public.point_rule('creator_bonus_every')::integer;
  if v_post.author_id is not null and v_post.author_id is distinct from v_uid and v_every > 0
     and exists (select 1 from public.profiles where id = v_post.author_id and account_type = 'student') then
    select count(distinct user_id) into v_votes from public.post_votes
     where post_id = p_post_id and user_id is distinct from v_post.author_id;
    if v_votes % v_every = 0 then
      v_bonus := public.point_rule('creator_bonus')::integer;
      if v_bonus > 0 then
        insert into public.point_ledger (user_id, amount, status, reason, ref_id)
        values (v_post.author_id, v_bonus, 'confirmed', 'creator_bonus', 'post:' || p_post_id || ':' || v_votes);
      end if;
    end if;
  end if;

  return jsonb_build_object('reward', v_reward);
end;
$$;
revoke execute on function public.vote_post_multi(bigint, integer[]) from public, anon;
grant execute on function public.vote_post_multi(bigint, integer[]) to authenticated;

-- =========================================================
-- 7. 목록·글 하나 (20261103000002와 같고, 아래만 다름)
--    · 투표 수 = 투표한 사람 수 · my_choices(내가 고른 보기들) · images · poll_multi · poll_closes_at
--    · 일반 글 투표는 마감되면 투표 안 한 사람도 결과를 본다
--    · 내가 차단한 사람의 글은 빼고, 차단한 사람 글을 열면 찾을 수 없음
-- =========================================================
create or replace function public.get_feed(p_kind text default null, p_sort text default 'popular')
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
           (select count(distinct v.user_id) from public.post_votes v where v.post_id = p.id)::integer as votes,
           (select min(v.choice) from public.post_votes v where v.post_id = p.id and v.user_id = v_uid) as my_choice,
           (select array_agg(v.choice order by v.choice) from public.post_votes v
             where v.post_id = p.id and v.user_id = v_uid) as my_choices,
           (select count(*) from public.comments c
             where c.target_type = 'post' and c.target_id = p.id and c.moderation = 'visible')::integer as comment_count
      from public.posts p
     where p.moderation = 'visible'
       and (p_kind is null or p.kind = p_kind)
       and (p.kind <> 'promo' or public.promo_survey_open(p.survey_id))
       and not public.is_blocked_by(v_uid, p.author_id)
     order by
       case when coalesce(p_sort, 'popular') = 'popular'
            then (select count(distinct v.user_id) from public.post_votes v where v.post_id = p.id)
                 + (select count(*) from public.comments c
                     where c.target_type = 'post' and c.target_id = p.id and c.moderation = 'visible') end desc nulls last,
       p.created_at desc
     limit 50
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', id, 'kind', kind, 'question', question, 'body', body, 'options', to_jsonb(options),
             'author', public.post_author_name(author_id, anonymous),
             'mine', author_id is not distinct from v_uid,
             'created_at', created_at, 'votes', votes, 'my_choice', my_choice, 'my_choices', to_jsonb(my_choices),
             'comment_count', comment_count,
             'images', to_jsonb(images), 'poll_multi', poll_multi, 'poll_closes_at', poll_closes_at,
             'counts', case when kind <> 'promo' and cardinality(options) > 0
                             and (my_choice is not null or author_id is not distinct from v_uid
                                  or (poll_closes_at is not null and poll_closes_at <= now()))
                            then public.post_counts(id, cardinality(options)) end,
             'survey', case when kind = 'promo' then public.promo_survey_info(survey_id, v_uid) end
           )
           order by case when coalesce(p_sort, 'popular') = 'popular' then votes + comment_count end desc nulls last,
                    created_at desc), '[]'::jsonb)
    into v_result
    from rows;
  return v_result;
end;
$$;

create or replace function public.get_post(p_post_id bigint)
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
  v_choices smallint[];
  v_show boolean;
  v_n integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_post from public.posts where id = p_post_id;
  if not found or v_post.moderation = 'deleted'
     or (v_post.moderation <> 'visible' and v_post.author_id is distinct from v_uid)
     or public.is_blocked_by(v_uid, v_post.author_id) then
    raise exception 'post_not_found';
  end if;
  select min(choice), array_agg(choice order by choice) into v_choice, v_choices
    from public.post_votes where post_id = p_post_id and user_id = v_uid;
  v_n := cardinality(v_post.options);
  v_show := v_post.kind <> 'promo' and v_n > 0
            and (v_choice is not null or v_post.author_id is not distinct from v_uid
                 or (v_post.poll_closes_at is not null and v_post.poll_closes_at <= now()));

  return jsonb_build_object(
    'id', v_post.id, 'kind', v_post.kind, 'question', v_post.question, 'body', v_post.body,
    'options', to_jsonb(v_post.options),
    'author', public.post_author_name(v_post.author_id, v_post.anonymous),
    'mine', v_post.author_id is not distinct from v_uid,
    'moderation', v_post.moderation,
    'created_at', v_post.created_at,
    'votes', (select count(distinct user_id) from public.post_votes where post_id = p_post_id),
    'comment_count', (select count(*) from public.comments
                       where target_type = 'post' and target_id = p_post_id and moderation = 'visible'),
    'my_choice', v_choice,
    'my_choices', to_jsonb(v_choices),
    'images', to_jsonb(v_post.images), 'poll_multi', v_post.poll_multi, 'poll_closes_at', v_post.poll_closes_at,
    'counts', case when v_show then public.post_counts(p_post_id, v_n) end,
    'groups', case when v_show and v_post.kind <> 'free' then jsonb_build_object(
      'major',  public.post_groups(p_post_id, 'major', v_n),
      'grade',  public.post_groups(p_post_id, 'grade', v_n),
      'gender', public.post_groups(p_post_id, 'gender', v_n),
      'age',    public.post_groups(p_post_id, 'age', v_n)) end,
    'survey', case when v_post.kind = 'promo' then public.promo_survey_info(v_post.survey_id, v_uid) end
  );
end;
$$;

-- =========================================================
-- 8. 댓글 목록 (20261114000003과 같고, 아래만 다름)
--    · 일반 글은 "고른 편" 배지 없음 · 고른 편은 min(choice) (여러 줄이어도 오류 없게)
--    · 내가 차단한 사람의 댓글은 뺀다 (익명 번호는 그대로 유지)
-- =========================================================
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
  v_kind text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not public.comment_target_ok(p_type, p_id) then
    raise exception 'post_not_found';
  end if;
  if p_type = 'post' then
    select author_id, kind into v_post_author, v_kind from public.posts where id = p_id;
    -- 일반 글은 "고른 편" 배지를 쓰지 않는다 (여러 개 고르기가 있어서)
    v_show_side := v_kind <> 'free'
                   and (v_post_author = v_uid
                        or exists (select 1 from public.post_votes where post_id = p_id and user_id = v_uid));
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
               (select min(v.choice) from public.post_votes v where v.post_id = p_id and v.user_id = b.author_id)
             end as side,
             (select count(*) from public.comment_likes l where l.comment_id = b.id)::integer as likes,
             exists (select 1 from public.comment_likes l where l.comment_id = b.id and l.user_id = v_uid) as liked
        from base b
        left join nums n on n.author_id = b.author_id
       where not public.is_blocked_by(v_uid, b.author_id)
         and (b.moderation = 'visible'
              -- 지운·숨긴 원댓글도 보이는 답글이 있으면 자리를 남긴다
              or (b.parent_id is null
                  and exists (select 1 from base r where r.parent_id = b.id and r.moderation = 'visible')))
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

-- =========================================================
-- 9. 내 참여 목록 (20261114000007과 같고, 일반 글 여러 개 고르기는 한 줄로 "보기1, 보기2")
-- =========================================================
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
                 string_agg(p.options[v.choice + 1], ', ' order by v.choice) as choice, min(v.created_at) as created_at
            from public.post_votes v
            join public.posts p on p.id = v.post_id
           where v.user_id = v_uid and p.moderation = 'visible'
           group by p.id, p.kind, p.question
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
