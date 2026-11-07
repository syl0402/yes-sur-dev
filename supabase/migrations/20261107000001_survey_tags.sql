-- 설문 태그 (2026-11-07 팀 피드백: 카테고리 복수 선택 요청 → 카테고리는 1개 유지, 대신 태그 최대 3개)
--
-- 카테고리 = 큰 분류 1개 (목록 필터) / 태그 = 세부 주제 여러 개 (카드에 #태그, 누르면 같은 탭에서 걸러 보기)
-- 태그는 운영자가 정해 둔 목록에서만 고른다 (자유 입력은 중복·오타·비속어가 생김)
-- 기존 설문·카테고리·create_survey는 그대로. 태그는 등록 뒤 set_survey_tags로 따로 붙인다
--   1. tags · survey_tags 표
--   2. point_rules survey_tag_max
--   3. set_survey_tags()
--   4. get_hub_list 출력에 tags 추가
--   5. 첫 태그 목록

-- =========================================================
-- 1. 표
-- =========================================================
create table public.tags (
  id bigint generated always as identity primary key,
  name text not null unique,
  sort_order integer not null default 0,
  -- false면 새로 고를 수 없고 목록에서도 숨김 (이미 붙은 설문 연결은 남김)
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.tags enable row level security;

create policy "로그인한 사람은 쓰는 태그를 읽을 수 있다"
  on public.tags for select
  to authenticated
  using (active);

-- 설문 하나에 태그 여러 개. 같은 태그 두 번은 기본 키로 막는다
create table public.survey_tags (
  survey_id bigint not null references public.surveys (id) on delete cascade,
  tag_id bigint not null references public.tags (id),
  primary key (survey_id, tag_id)
);

create index survey_tags_tag_idx on public.survey_tags (tag_id);

alter table public.survey_tags enable row level security;

-- 볼 수 있는 설문의 태그만 (설문 RLS를 그대로 따른다). 쓰기 정책 없음 = 앱은 set_survey_tags로만
create policy "볼 수 있는 설문의 태그를 읽을 수 있다"
  on public.survey_tags for select
  to authenticated
  using (exists (select 1 from public.surveys s where s.id = survey_id));

-- =========================================================
-- 2. 설정값
-- =========================================================
insert into public.point_rules (key, value, description) values
  ('survey_tag_max', 3, '설문 하나에 붙일 수 있는 태그 수 (포인트 아님)');

-- =========================================================
-- 3. 태그 붙이기: 내 설문만 · 최대 개수 · 쓰는 태그만. 지우고 다시 넣어서 두 번 불러도 결과가 같다
-- =========================================================
create function public.set_survey_tags(p_survey_id bigint, p_tag_ids bigint[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ids bigint[];
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.surveys where id = p_survey_id and owner_id = v_uid) then
    raise exception 'not_survey_owner';
  end if;

  select coalesce(array_agg(distinct t), '{}') into v_ids from unnest(coalesce(p_tag_ids, '{}')) as t;
  if cardinality(v_ids) > public.point_rule('survey_tag_max') then
    raise exception 'too_many_tags';
  end if;
  if exists (select 1 from unnest(v_ids) as t
              where not exists (select 1 from public.tags g where g.id = t and g.active)) then
    raise exception 'tag_not_found';
  end if;

  delete from public.survey_tags where survey_id = p_survey_id;
  insert into public.survey_tags (survey_id, tag_id)
  select p_survey_id, t from unnest(v_ids) as t;
end;
$$;

revoke execute on function public.set_survey_tags(bigint, bigint[]) from public, anon;
grant execute on function public.set_survey_tags(bigint, bigint[]) to authenticated;

-- 설문 하나의 태그 [{id, name}] (목록 함수들이 같이 쓴다)
create function public.survey_tag_list(p_survey_id bigint)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name) order by g.sort_order, g.id), '[]'::jsonb)
    from public.survey_tags st
    join public.tags g on g.id = st.tag_id
   where st.survey_id = p_survey_id;
$$;

revoke execute on function public.survey_tag_list(bigint) from public, anon, authenticated;

-- =========================================================
-- 4. 데이터 탭 목록에 태그 (20261030000015 기반, 'tags'만 추가)
-- =========================================================
create or replace function public.get_hub_list(p_category text default null, p_sort text default 'popular')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_org boolean;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select account_type = 'org' into v_is_org from public.profiles where id = v_uid;

  with rows as (
    select s.id, s.title, s.host_name, s.host_verified, s.response_count, s.question_count,
           coalesce(s.closes_at, s.created_at) as ended_at,
           c.key as category_key, c.name as category_name,
           (select count(*) from public.survey_views v where v.survey_id = s.id)::integer as view_count,
           (select count(*) from public.responses r where r.survey_id = s.id)::integer as all_count,
           exists (select 1 from public.survey_views v where v.survey_id = s.id and v.user_id = v_uid) as viewed,
           exists (select 1 from public.responses r
                    where r.survey_id = s.id and r.user_id = v_uid and r.status = 'confirmed') as answered,
           s.owner_id is not distinct from v_uid as mine,
           public.survey_free_reason(s.id) as free_reason,
           public.survey_tag_list(s.id) as tags
      from public.surveys s
      join public.survey_categories c on c.id = s.category_id
     where s.owner_id is distinct from v_uid
       and public.survey_listed(s.id, v_uid)
       and (p_category is null or c.key = p_category)
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', id, 'title', title, 'host_name', host_name, 'host_verified', host_verified,
             'category_key', category_key, 'category_name', category_name,
             'response_count', response_count, 'view_count', view_count, 'ended_at', ended_at,
             'viewed', viewed, 'answered', answered,
             'free', free_reason is not null or v_is_org,
             'trusted', response_count >= public.point_rule('trust_min_responses')
                        and all_count > 0
                        and response_count::numeric / all_count >= public.point_rule('trust_min_pass_rate'),
             'low_count', response_count < public.point_rule('low_response_warning'),
             'tags', tags
           )
           order by
             case when p_sort = 'responses' then response_count end desc nulls last,
             case when p_sort = 'latest' then ended_at end desc nulls last,
             case when coalesce(p_sort, 'popular') = 'popular' then view_count end desc nulls last,
             ended_at desc
         ), '[]'::jsonb)
    into v_result
    from rows;

  return v_result;
end;
$$;

-- =========================================================
-- 5. 첫 태그 목록
-- TODO(임시): 개발자가 정한 목록 · 기획팀 확정 목록이 오면 교체 (active=false로 숨기고 새로 추가) · docs/PROGRESS.md
-- =========================================================
insert into public.tags (name, sort_order) values
  ('연애', 1), ('MBTI', 2), ('학식', 3), ('과제·팀플', 4), ('시험', 5),
  ('진로', 6), ('취업', 7), ('알바', 8), ('돈 관리', 9), ('자취', 10),
  ('통학', 11), ('동아리', 12), ('수면', 13), ('운동', 14), ('다이어트', 15),
  ('음식', 16), ('여행', 17), ('취미', 18), ('게임', 19), ('SNS', 20);
