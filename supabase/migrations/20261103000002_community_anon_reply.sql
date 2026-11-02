-- 커뮤니티: 익명 번호 · 대댓글 · 베스트 댓글 기준 (2026-11-03)
--
-- 이름: 글·댓글은 기본 익명 (쓸 때 체크를 풀면 닉네임). 학생만 익명 가능, 단체·운영자는 항상 단체 이름/옛썰 공식
--   글: "익명"
--   댓글: 한 글 안에서 익명으로 처음 댓글 단 순서대로 "익명1, 익명2…", 글쓴이는 "익명(글쓴이)"
--         지운·숨긴 댓글도 세서 나중에 번호가 바뀌지 않는다. 다른 글에서는 다른 번호
-- 대댓글: 한 단계만 (답글에 답글은 안 됨). 지운 원댓글에 답글이 있으면 "삭제된 댓글" 자리로 남긴다
-- 베스트 댓글: 공감(= 기존 좋아요) best_comment_min개 이상일 때만, 최대 3개
-- 누가 썼는지(author_id)는 앱에 보내지 않는다 (지금과 같음)

insert into public.point_rules (key, value, description) values
  ('best_comment_min', 3, '베스트 댓글: 공감이 이만큼은 있어야 위에 올라감');

-- =========================================================
-- 1. 칸 추가 (기존 글·댓글도 익명이 된다)
-- =========================================================
alter table public.posts add column anonymous boolean not null default true;
alter table public.comments add column anonymous boolean not null default true;
alter table public.comments add column parent_id bigint references public.comments (id) on delete cascade;
create index comments_parent_idx on public.comments (parent_id);

-- =========================================================
-- 2. 이름 정하기 (안에서만 쓰는 함수)
-- =========================================================
-- 익명으로 쓸 수 있는 사람: 운영자가 아닌 학생
create function public.can_post_anonymously(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles
                  where id = p_uid and account_type = 'student' and role is distinct from 'admin');
$$;

-- 글 작성자 이름: 익명 / 닉네임 / 단체 이름 / 옛썰 공식 / 탈퇴한 회원
create function public.post_author_name(p_author uuid, p_anonymous boolean)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when p_author is null then case when p_anonymous then '익명' else '탈퇴한 회원' end
           when p_anonymous and public.can_post_anonymously(p_author) then '익명'
           else public.display_name(p_author)
         end;
$$;

revoke execute on function public.can_post_anonymously(uuid) from public, anon, authenticated;
revoke execute on function public.post_author_name(uuid, boolean) from public, anon, authenticated;

-- =========================================================
-- 3. 글 만들기: 익명 여부 (나머지는 20261030000020과 같음)
-- =========================================================
drop function public.create_post(text, text, text[], text);
create function public.create_post(p_kind text, p_question text, p_options text[] default null, p_body text default null,
                                   p_anonymous boolean default true)
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

  insert into public.posts (author_id, kind, question, options, body, anonymous)
  values (v_uid, p_kind, v_question, v_options, v_body,
          coalesce(p_anonymous, true) and public.can_post_anonymously(v_uid))
  returning id into v_id;
  return v_id;
end;
$$;

-- =========================================================
-- 4. 댓글 달기: 답글(한 단계) · 익명 여부
-- =========================================================
drop function public.create_comment(text, bigint, text);
create function public.create_comment(p_type text, p_id bigint, p_body text,
                                      p_parent_id bigint default null, p_anonymous boolean default true)
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
  -- 답글: 같은 글의, 보이는, 원댓글(답글이 아닌 것)에만
  if p_parent_id is not null and not exists (
       select 1 from public.comments
        where id = p_parent_id and target_type = p_type and target_id = p_id
          and moderation = 'visible' and parent_id is null) then
    raise exception 'comment_not_found';
  end if;

  perform 1 from public.profiles where id = v_uid for update;
  if (select count(*) from public.comments where author_id = v_uid and created_at >= public.kst_day_start())
     >= public.point_rule('comment_daily_max') then
    raise exception 'comment_limit';
  end if;

  insert into public.comments (target_type, target_id, author_id, body, parent_id, anonymous)
  values (p_type, p_id, v_uid, v_body, p_parent_id,
          coalesce(p_anonymous, true) and public.can_post_anonymously(v_uid))
  returning id into v_id;
  return v_id;
end;
$$;

-- =========================================================
-- 5. 댓글 목록
-- { best: [댓글], all: [원댓글 + replies: [답글]] }
-- 댓글: { id, parent_id, deleted, body, author, mine, likes, liked, created_at }
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
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not public.comment_target_ok(p_type, p_id) then
    raise exception 'post_not_found';
  end if;
  if p_type = 'post' then
    select author_id into v_post_author from public.posts where id = p_id;
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
             (select count(*) from public.comment_likes l where l.comment_id = b.id)::integer as likes,
             exists (select 1 from public.comment_likes l where l.comment_id = b.id and l.user_id = v_uid) as liked
        from base b
        left join nums n on n.author_id = b.author_id
       where b.moderation = 'visible'
          -- 지운·숨긴 원댓글도 보이는 답글이 있으면 자리를 남긴다
          or (b.parent_id is null
              and exists (select 1 from base r where r.parent_id = b.id and r.moderation = 'visible'))
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
-- 6. 목록·글 하나: 작성자 이름만 익명 반영 (나머지는 20261030000023과 같음)
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
       and (p.kind <> 'promo' or public.promo_survey_open(p.survey_id))
     order by
       case when coalesce(p_sort, 'popular') = 'popular'
            then (select count(*) from public.post_votes v where v.post_id = p.id)
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
             'created_at', created_at, 'votes', votes, 'my_choice', my_choice, 'comment_count', comment_count,
             'counts', case when kind <> 'promo' and (my_choice is not null or author_id is not distinct from v_uid)
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
  v_show boolean;
  v_n integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_post from public.posts where id = p_post_id;
  if not found or v_post.moderation = 'deleted'
     or (v_post.moderation <> 'visible' and v_post.author_id is distinct from v_uid) then
    raise exception 'post_not_found';
  end if;
  select choice into v_choice from public.post_votes where post_id = p_post_id and user_id = v_uid;
  v_show := v_post.kind <> 'promo' and (v_choice is not null or v_post.author_id is not distinct from v_uid);
  v_n := cardinality(v_post.options);

  return jsonb_build_object(
    'id', v_post.id, 'kind', v_post.kind, 'question', v_post.question, 'body', v_post.body,
    'options', to_jsonb(v_post.options),
    'author', public.post_author_name(v_post.author_id, v_post.anonymous),
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
      'age',    public.post_groups(p_post_id, 'age', v_n)) end,
    'survey', case when v_post.kind = 'promo' then public.promo_survey_info(v_post.survey_id, v_uid) end
  );
end;
$$;

revoke execute on function public.create_post(text, text, text[], text, boolean) from public, anon;
revoke execute on function public.create_comment(text, bigint, text, bigint, boolean) from public, anon;
grant execute on function public.create_post(text, text, text[], text, boolean) to authenticated;
grant execute on function public.create_comment(text, bigint, text, bigint, boolean) to authenticated;
