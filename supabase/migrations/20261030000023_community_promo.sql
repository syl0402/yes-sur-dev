-- 커뮤니티 3단계: 설문 홍보 게시판 + 계열 대항전 (2026-10-30)
--
-- 설문 홍보: posts.kind = 'promo'. 내 진행 중 설문 하나에 홍보글 하나 (한 줄 소개 + 본문 선택).
--           피드 카드에 보상·소요시간·남은 자리 + [응답하러 가기]. 설문이 마감되면 피드에서 사라진다.
--           투표는 없고 댓글은 된다. 하루 글 수 제한(post_daily_max)에 함께 센다
-- 계열 대항전: 이번 주(한국 시간 월요일 0시부터) 계열별 참여 수 = 투표 + 오늘의 질문 + 글 + 댓글.
--             학교 비교는 하지 않는다. 미입력은 순위에서 뺀다

-- =========================================================
-- 1. 홍보글 구조
-- =========================================================
alter table public.posts drop constraint posts_kind_check;
alter table public.posts add constraint posts_kind_check
  check (kind in ('balance', 'relate', 'pick', 'promo'));

-- 홍보글은 보기가 없다
alter table public.posts drop constraint posts_options_check;
alter table public.posts add constraint posts_options_check
  check ((kind = 'promo' and cardinality(options) = 0)
      or (kind <> 'promo' and cardinality(options) between 2 and 4));

alter table public.posts
  add column survey_id bigint references public.surveys (id) on delete cascade;

alter table public.posts add constraint posts_promo_survey_check
  check ((kind = 'promo') = (survey_id is not null));

-- 설문 하나에 홍보글 하나 (작성자가 지우면 다시 올릴 수 있음)
create unique index posts_one_promo_per_survey
  on public.posts (survey_id) where kind = 'promo' and moderation <> 'deleted';

-- 홍보글이 피드에 보일 수 있나: 설문이 진행 중이고 숨겨지지 않음
create function public.promo_survey_open(p_survey_id bigint)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.surveys s
     where s.id = p_survey_id
       and s.status = 'open'
       and (s.closes_at is null or s.closes_at > now())
       and s.moderation = 'visible'
  );
$$;

-- 홍보글 카드에 붙일 설문 정보 (보는 사람 기준 응답 여부 포함)
create function public.promo_survey_info(p_survey_id bigint, p_uid uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
           'id', s.id, 'title', s.title,
           'reward', s.reward_points, 'minutes', s.est_minutes, 'questions', s.question_count,
           'remaining', greatest(s.target_responses - s.response_count, 0),
           'closes_at', s.closes_at,
           'open', public.promo_survey_open(s.id),
           'answered', exists (select 1 from public.responses r
                                where r.survey_id = s.id and r.user_id = p_uid and r.status = 'confirmed'))
    from public.surveys s
   where s.id = p_survey_id;
$$;

revoke execute on function public.promo_survey_open(bigint) from public, anon, authenticated;
revoke execute on function public.promo_survey_info(bigint, uuid) from public, anon, authenticated;

-- =========================================================
-- 2. create_promo: 내 진행 중 설문 홍보 → 글 번호
-- =========================================================
create function public.create_promo(p_survey_id bigint, p_question text, p_body text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_question text := btrim(coalesce(p_question, ''));
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if char_length(v_question) not between 1 and 100 or char_length(coalesce(v_body, '')) > 500 then
    raise exception 'invalid_post';
  end if;
  if not exists (select 1 from public.surveys where id = p_survey_id and owner_id = v_uid) then
    raise exception 'not_owner';
  end if;
  if not public.promo_survey_open(p_survey_id) then
    raise exception 'survey_closed';
  end if;

  perform 1 from public.profiles where id = v_uid for update;
  if (select count(*) from public.posts where author_id = v_uid and created_at >= public.kst_day_start())
     >= public.point_rule('post_daily_max') then
    raise exception 'post_limit';
  end if;

  begin
    insert into public.posts (author_id, kind, question, options, body, survey_id)
    values (v_uid, 'promo', v_question, '{}', v_body, p_survey_id)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'promo_exists';
  end;
  return v_id;
end;
$$;

-- =========================================================
-- 3. 목록·글 하나: 홍보글 포함 (마감된 설문의 홍보글은 목록에서 뺀다)
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
             'author', public.display_name(author_id),
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
      'age',    public.post_groups(p_post_id, 'age', v_n)) end,
    'survey', case when v_post.kind = 'promo' then public.promo_survey_info(v_post.survey_id, v_uid) end
  );
end;
$$;

-- 홍보할 수 있는 내 설문 (진행 중, 아직 홍보글 없음) → [{ id, title }]
create function public.get_promotable_surveys()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title) order by s.created_at desc), '[]'::jsonb)
    from public.surveys s
   where s.owner_id = auth.uid()
     and public.promo_survey_open(s.id)
     and not exists (select 1 from public.posts p
                      where p.survey_id = s.id and p.kind = 'promo' and p.moderation <> 'deleted');
$$;

-- =========================================================
-- 4. 계열 대항전: 이번 주 계열별 참여 수
-- { week_start, ranking: [{ major, count, rank }], my_major, my_rank }
-- =========================================================
create function public.get_major_ranking()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  -- 한국 시간 이번 주 월요일 0시
  v_start timestamptz := date_trunc('week', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_my text;
  v_ranking jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  v_my := public.respondent_group('major', v_uid);

  with acts as (
    select grp_major as major from public.post_votes where created_at >= v_start
    union all
    select grp_major from public.daily_answers where created_at >= v_start
    union all
    select public.respondent_group('major', author_id) from public.posts
     where created_at >= v_start and author_id is not null and moderation <> 'deleted'
    union all
    select public.respondent_group('major', author_id) from public.comments
     where created_at >= v_start and author_id is not null and moderation <> 'deleted'
  ),
  counted as (
    select major, count(*)::integer as cnt from acts
     where major is not null and major <> '미입력'
     group by major
  ),
  ranked as (
    select major, cnt, rank() over (order by cnt desc)::integer as rnk from counted
  )
  select coalesce(jsonb_agg(jsonb_build_object('major', major, 'count', cnt, 'rank', rnk) order by rnk, major), '[]'::jsonb)
    into v_ranking
    from ranked;

  return jsonb_build_object(
    'week_start', (v_start at time zone 'Asia/Seoul')::date,
    'ranking', v_ranking,
    'my_major', case when v_my <> '미입력' then v_my end,
    'my_rank', (select (e ->> 'rank')::integer from jsonb_array_elements(v_ranking) e where e ->> 'major' = v_my)
  );
end;
$$;

revoke execute on function public.create_promo(bigint, text, text) from public, anon;
revoke execute on function public.get_promotable_surveys() from public, anon;
revoke execute on function public.get_major_ranking() from public, anon;
grant execute on function public.create_promo(bigint, text, text) to authenticated;
grant execute on function public.get_promotable_surveys() to authenticated;
grant execute on function public.get_major_ranking() to authenticated;
