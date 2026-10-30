-- 커뮤니티 2-1: 본문 · 내 글 수정/삭제 · 댓글 · 좋아요 · 글/댓글 신고 (2026-10-30)
--
-- 글: 본문(선택, 500자). 질문·보기는 투표가 있으니 못 바꾸고, 본문만 수정. 삭제는 언제든 (moderation = 'deleted')
--     삭제해도 이미 받은 투표·만든 사람 포인트는 그대로
-- 댓글: comments 표 하나 (target_type + target_id). 지금은 글(post), 2-2에서 지난 오늘의 질문(daily)
--       200자, 하루 comment_daily_max개, 내 것은 삭제. 좋아요 (내 댓글엔 못 누름)
-- 신고: 글·댓글도 신고 → 확인 전 신고 report_hide_count명이면 자동 숨김 (설문과 같은 규칙)
-- 앱은 표를 직접 읽지 않는다. 모두 서버 함수로

-- =========================================================
-- 1. 설정값
-- =========================================================
insert into public.point_rules (key, value, description) values
  ('comment_daily_max', 50, '댓글 하루 최대 개수 (도배 방지)');

-- =========================================================
-- 2. 글: 본문 · 작성자 삭제 상태
-- =========================================================
alter table public.posts
  add column body text check (char_length(body) <= 500);

-- visible 보임 / hidden 신고로 숨김 / removed 운영자 삭제 / deleted 작성자 삭제
alter table public.posts drop constraint posts_moderation_check;
alter table public.posts add constraint posts_moderation_check
  check (moderation in ('visible', 'hidden', 'removed', 'deleted'));

-- =========================================================
-- 3. 댓글 · 좋아요
-- =========================================================
create table public.comments (
  id bigint generated always as identity primary key,
  target_type text not null check (target_type in ('post', 'daily')),
  target_id bigint not null,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 200),
  moderation text not null default 'visible' check (moderation in ('visible', 'hidden', 'removed', 'deleted')),
  created_at timestamptz not null default now()
);

create index comments_target_idx on public.comments (target_type, target_id);

create table public.comment_likes (
  id bigint generated always as identity primary key,
  comment_id bigint not null references public.comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
revoke all on public.comments, public.comment_likes from anon, authenticated;

-- 신고 대상 확장
alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('survey', 'post', 'comment'));

-- =========================================================
-- 4. 글 만들기 (본문 추가) · 본문 수정 · 삭제
-- =========================================================
drop function public.create_post(text, text, text[]);

create function public.create_post(p_kind text, p_question text, p_options text[] default null, p_body text default null)
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
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_kind is null or p_kind not in ('balance', 'relate', 'pick') then
    raise exception 'invalid_post';
  end if;
  if char_length(v_question) not between 1 and 100 or char_length(coalesce(v_body, '')) > 500 then
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

  perform 1 from public.profiles where id = v_uid for update;
  if (select count(*) from public.posts where author_id = v_uid and created_at >= public.kst_day_start())
     >= public.point_rule('post_daily_max') then
    raise exception 'post_limit';
  end if;

  insert into public.posts (author_id, kind, question, options, body)
  values (v_uid, p_kind, v_question, v_options, v_body)
  returning id into v_id;
  return v_id;
end;
$$;

-- 본문만 수정 (작성자, 삭제 안 된 글)
create function public.update_post_body(p_post_id bigint, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if char_length(coalesce(v_body, '')) > 500 then
    raise exception 'invalid_post';
  end if;
  update public.posts set body = v_body
   where id = p_post_id and author_id = auth.uid() and moderation <> 'deleted';
  if not found then
    raise exception 'post_not_found';
  end if;
end;
$$;

-- 내 글 삭제 (포인트는 그대로)
create function public.delete_post(p_post_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  update public.posts set moderation = 'deleted'
   where id = p_post_id and author_id = auth.uid() and moderation <> 'deleted';
  if not found then
    raise exception 'post_not_found';
  end if;
end;
$$;

-- =========================================================
-- 5. 목록·글 하나: 본문 · 댓글 수 추가 (나머지는 20261030000019와 같음)
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
           (select count(*) from public.post_votes v where v.post_id = p.id)::integer as votes,
           (select v.choice from public.post_votes v where v.post_id = p.id and v.user_id = v_uid) as my_choice,
           (select count(*) from public.comments c
             where c.target_type = 'post' and c.target_id = p.id and c.moderation = 'visible')::integer as comment_count
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
             'id', id, 'kind', kind, 'question', question, 'body', body, 'options', to_jsonb(options),
             'author', public.display_name(author_id),
             'mine', author_id is not distinct from v_uid,
             'created_at', created_at, 'votes', votes, 'my_choice', my_choice, 'comment_count', comment_count,
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
  v_show boolean;
  v_n integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_post from public.posts where id = p_post_id;
  -- 작성자가 지운 글은 아무도 못 봄. 신고로 숨긴 글은 작성자만
  if not found or v_post.moderation = 'deleted'
     or (v_post.moderation <> 'visible' and v_post.author_id is distinct from v_uid) then
    raise exception 'post_not_found';
  end if;
  select choice into v_choice from public.post_votes where post_id = p_post_id and user_id = v_uid;
  v_show := v_choice is not null or v_post.author_id is not distinct from v_uid;
  v_n := cardinality(v_post.options);

  return jsonb_build_object(
    'id', v_post.id, 'kind', v_post.kind, 'question', v_post.question, 'body', v_post.body,
    'options', to_jsonb(v_post.options),
    'author', public.display_name(v_post.author_id),
    'mine', v_post.author_id is not distinct from v_uid,
    'moderation', v_post.moderation,
    'created_at', v_post.created_at,
    'votes', (select count(*) from public.post_votes where post_id = p_post_id),
    'comment_count', (select count(*) from public.comments
                       where target_type = 'post' and target_id = p_post_id and moderation = 'visible'),
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

-- =========================================================
-- 6. 댓글
-- =========================================================

-- 댓글을 달 수 있는 대상인가: 보이는 글, 또는 오늘까지 올라온 오늘의 질문
create function public.comment_target_ok(p_type text, p_id bigint)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case p_type
           when 'post' then exists (select 1 from public.posts where id = p_id and moderation = 'visible')
           when 'daily' then exists (select 1 from public.daily_questions
                                      where id = p_id and day <= (now() at time zone 'Asia/Seoul')::date)
           else false
         end;
$$;

revoke execute on function public.comment_target_ok(text, bigint) from public, anon, authenticated;

create function public.create_comment(p_type text, p_id bigint, p_body text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if char_length(v_body) not between 1 and 200 then
    raise exception 'invalid_comment';
  end if;
  if not public.comment_target_ok(p_type, p_id) then
    raise exception 'post_not_found';
  end if;

  perform 1 from public.profiles where id = v_uid for update;
  if (select count(*) from public.comments where author_id = v_uid and created_at >= public.kst_day_start())
     >= public.point_rule('comment_daily_max') then
    raise exception 'comment_limit';
  end if;

  insert into public.comments (target_type, target_id, author_id, body)
  values (p_type, p_id, v_uid, v_body)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.delete_comment(p_comment_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  update public.comments set moderation = 'deleted'
   where id = p_comment_id and author_id = auth.uid() and moderation <> 'deleted';
  if not found then
    raise exception 'comment_not_found';
  end if;
end;
$$;

-- 좋아요 누르기/취소 → { liked, likes }
create function public.like_comment(p_comment_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_author uuid;
  v_liked boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select author_id into v_author from public.comments where id = p_comment_id and moderation = 'visible';
  if not found then
    raise exception 'comment_not_found';
  end if;
  if v_author = v_uid then
    raise exception 'own_comment';
  end if;

  delete from public.comment_likes where comment_id = p_comment_id and user_id = v_uid;
  if found then
    v_liked := false;
  else
    insert into public.comment_likes (comment_id, user_id) values (p_comment_id, v_uid)
    on conflict (comment_id, user_id) do nothing;
    v_liked := true;
  end if;

  return jsonb_build_object('liked', v_liked,
    'likes', (select count(*) from public.comment_likes where comment_id = p_comment_id));
end;
$$;

-- 댓글 목록 → { best: [좋아요 많은 3개], all: [오래된 순] }
-- 각 댓글: { id, body, author, mine, likes, liked, created_at }
create function public.get_comments(p_type text, p_id bigint)
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
  if not public.comment_target_ok(p_type, p_id) then
    raise exception 'post_not_found';
  end if;

  return (
    with c as (
      select c.id, c.body, c.author_id, c.created_at,
             (select count(*) from public.comment_likes l where l.comment_id = c.id)::integer as likes,
             exists (select 1 from public.comment_likes l where l.comment_id = c.id and l.user_id = v_uid) as liked
        from public.comments c
       where c.target_type = p_type and c.target_id = p_id and c.moderation = 'visible'
       order by c.created_at
       limit 300
    ),
    j as (
      select id, likes, created_at,
             jsonb_build_object('id', id, 'body', body, 'author', public.display_name(author_id),
                                'mine', author_id is not distinct from v_uid,
                                'likes', likes, 'liked', liked, 'created_at', created_at) as obj
        from c
    )
    select jsonb_build_object(
      'best', (select coalesce(jsonb_agg(obj order by likes desc, created_at), '[]'::jsonb)
                 from (select * from j where likes > 0 order by likes desc, created_at limit 3) b),
      'all', (select coalesce(jsonb_agg(obj order by created_at), '[]'::jsonb) from j)
    )
  );
end;
$$;

-- =========================================================
-- 7. 글·댓글 신고 (설문은 report_survey 그대로)
-- =========================================================
create function public.report_content(p_type text, p_id bigint, p_reason text, p_detail text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_author uuid;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_type = 'survey' then
    perform public.report_survey(p_id, p_reason, p_detail);
    return;
  end if;
  if p_type = 'post' then
    select author_id into v_author from public.posts where id = p_id and moderation = 'visible' for update;
  elsif p_type = 'comment' then
    select author_id into v_author from public.comments where id = p_id and moderation = 'visible' for update;
  else
    raise exception 'invalid_reason';
  end if;
  if not found then
    raise exception 'post_not_found';
  end if;
  if v_author = v_uid then
    raise exception 'report_own_survey';
  end if;
  if p_reason is null or p_reason not in ('spam', 'abuse', 'privacy', 'sexual', 'other') then
    raise exception 'invalid_reason';
  end if;

  begin
    insert into public.reports (target_type, target_id, reporter_id, reason, detail)
    values (p_type, p_id, v_uid, p_reason, nullif(left(btrim(coalesce(p_detail, '')), 200), ''));
  exception when unique_violation then
    raise exception 'already_reported';
  end;

  select count(*) into v_count from public.reports
   where target_type = p_type and target_id = p_id and status = 'pending';
  if v_count >= public.point_rule('report_hide_count') then
    if p_type = 'post' then
      update public.posts set moderation = 'hidden' where id = p_id and moderation = 'visible';
    else
      update public.comments set moderation = 'hidden' where id = p_id and moderation = 'visible';
    end if;
  end if;
end;
$$;

revoke execute on function public.create_post(text, text, text[], text) from public, anon;
revoke execute on function public.update_post_body(bigint, text) from public, anon;
revoke execute on function public.delete_post(bigint) from public, anon;
revoke execute on function public.create_comment(text, bigint, text) from public, anon;
revoke execute on function public.delete_comment(bigint) from public, anon;
revoke execute on function public.like_comment(bigint) from public, anon;
revoke execute on function public.get_comments(text, bigint) from public, anon;
revoke execute on function public.report_content(text, bigint, text, text) from public, anon;
grant execute on function public.create_post(text, text, text[], text) to authenticated;
grant execute on function public.update_post_body(bigint, text) to authenticated;
grant execute on function public.delete_post(bigint) to authenticated;
grant execute on function public.create_comment(text, bigint, text) to authenticated;
grant execute on function public.delete_comment(bigint) to authenticated;
grant execute on function public.like_comment(bigint) to authenticated;
grant execute on function public.get_comments(text, bigint) to authenticated;
grant execute on function public.report_content(text, bigint, text, text) to authenticated;
