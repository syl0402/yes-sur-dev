-- 회원 탈퇴 (2026-10-30) · Google Play: 앱 안에서 계정 삭제 필수
--
-- 정한 것:
--   - 응답은 익명으로 남긴다 (누가 답했는지만 끊음). 남의 설문 결과·이미 열람한 결과가 바뀌지 않게
--   - 내 설문: 진행 중은 마감, "나만 보기"는 삭제, 공개된 결과는 "탈퇴한 회원" 설문으로 허브에 남김
--   - 포인트·신고·단체 정보는 함께 삭제
--   - 같은 메일로 다시 가입해도 웰컴 포인트는 한 번만 (메일 해시만 보관)
--
-- 바꾸는 것:
--   1. 응답에 그룹(계열·학년·성별·나이대)을 응답 시점 값으로 저장 → 탈퇴해도 나눠 보기 유지.
--      덤: 몇 년 뒤에 봐도 학년·나이가 응답 당시 기준으로 맞다
--   2. 회원 삭제 시 응답·설문·열람 기록은 남기고 사람 연결만 비운다 (on delete set null)
--   3. 등록자가 빈 설문 대비: get_hub_list·get_full_results·view_survey
--   4. 웰컴 포인트 한 번만 (welcomed_emails + 포인트 기록 트리거)
--   5. delete_my_account()

-- =========================================================
-- 1. 응답에 그룹 저장
-- =========================================================
alter table public.responses
  add column grp_major text,
  add column grp_grade text,
  add column grp_gender text,
  add column grp_age text;

-- 응답이 들어올 때 그 순간의 그룹을 채운다
create function public.fill_response_groups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.grp_major  := public.respondent_group('major', new.user_id);
  new.grp_grade  := public.respondent_group('grade', new.user_id);
  new.grp_gender := public.respondent_group('gender', new.user_id);
  new.grp_age    := public.respondent_group('age', new.user_id);
  return new;
end;
$$;

revoke execute on function public.fill_response_groups() from public, anon, authenticated;

create trigger responses_fill_groups
  before insert on public.responses
  for each row execute function public.fill_response_groups();

-- 기존 응답은 지금 값으로 채운다
update public.responses
   set grp_major  = public.respondent_group('major', user_id),
       grp_grade  = public.respondent_group('grade', user_id),
       grp_gender = public.respondent_group('gender', user_id),
       grp_age    = public.respondent_group('age', user_id);

-- 나눠 보기: 회원정보 대신 응답에 저장한 그룹으로
create or replace function public.survey_groups(p_survey_id bigint, p_ids bigint[], p_dim text, p_with_stats boolean)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with r as (
    select id,
           coalesce(case p_dim
                      when 'major' then grp_major
                      when 'grade' then grp_grade
                      when 'gender' then grp_gender
                      else grp_age
                    end, '미입력') as grp
      from public.responses
     where id = any (p_ids)
  ),
  g as (
    select grp, array_agg(id) as ids, count(*)::integer as n from r group by grp
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'label', grp,
             'hidden', n < public.point_rule('result_min_count'),
             'n', case when n < public.point_rule('result_min_count') then null else n end,
             'questions', case
               when p_with_stats and n >= public.point_rule('result_min_count')
                 then public.question_stats(p_survey_id, ids)
               else '[]'::jsonb end
           ) order by grp), '[]'::jsonb)
    from g;
$$;

-- 원본 CSV도 응답에 저장한 그룹으로 (나머지는 20261030000011과 같음)
create or replace function public.get_survey_raw(p_survey_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_ids bigint[];
  v_min numeric := public.point_rule('result_min_count');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select owner_id into v_owner from public.surveys where id = p_survey_id;
  if not found then
    raise exception 'survey_not_found';
  end if;
  if v_owner is distinct from v_uid then
    raise exception 'not_owner';
  end if;

  v_ids := public.survey_valid_ids(p_survey_id);

  return jsonb_build_object(
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'text', q.text, 'type', q.type) order by q.sort_order), '[]'::jsonb)
        from public.questions q
       where q.survey_id = p_survey_id and not q.is_attention_check),
    'rows', (
      with r as (
        select id,
               coalesce(grp_major, '미입력') as major,
               coalesce(grp_grade, '미입력') as grade,
               coalesce(grp_gender, '미입력') as gender,
               coalesce(grp_age, '미입력') as age
          from public.responses
         where id = any (v_ids)
      ),
      -- 인원이 적은 그룹은 이름을 가린다
      m as (
        select id,
               case when count(*) over (partition by major) < v_min then '5명 미만' else major end as major,
               case when count(*) over (partition by grade) < v_min then '5명 미만' else grade end as grade,
               case when count(*) over (partition by gender) < v_min then '5명 미만' else gender end as gender,
               case when count(*) over (partition by age) < v_min then '5명 미만' else age end as age
          from r
      )
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'major', m.major,
                 'grade', m.grade,
                 'gender', m.gender,
                 'age', m.age,
                 'answers', (
                   select coalesce(jsonb_agg(
                            case q.type
                              when 'scale' then a.scale_value::text
                              when 'text' then a.text_value
                              else (select string_agg(o.text, ' | ' order by o.sort_order)
                                      from public.question_options o
                                     where o.id = any (a.option_ids))
                            end order by q.sort_order), '[]'::jsonb)
                     from public.questions q
                     left join public.answers a on a.question_id = q.id and a.response_id = m.id
                    where q.survey_id = p_survey_id and not q.is_attention_check)
               ) order by md5(m.id::text)), '[]'::jsonb)
        from m)
  );
end;
$$;

-- =========================================================
-- 2. 회원 삭제 시 사람 연결만 비운다
-- =========================================================
alter table public.responses alter column user_id drop not null;
alter table public.responses drop constraint responses_user_id_fkey;
alter table public.responses
  add constraint responses_user_id_fkey foreign key (user_id) references public.profiles (id) on delete set null;

alter table public.surveys alter column owner_id drop not null;
alter table public.surveys drop constraint surveys_owner_id_fkey;
alter table public.surveys
  add constraint surveys_owner_id_fkey foreign key (owner_id) references public.profiles (id) on delete set null;

alter table public.survey_views alter column user_id drop not null;
alter table public.survey_views drop constraint survey_views_user_id_fkey;
alter table public.survey_views
  add constraint survey_views_user_id_fkey foreign key (user_id) references public.profiles (id) on delete set null;

-- =========================================================
-- 3. 등록자가 빈 설문 대비 (나머지는 20261030000009와 같음)
-- =========================================================

-- 목록: "내 설문 빼기"를 owner_id <> 나 → is distinct from (등록자가 비어도 목록에 남게)
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
           public.survey_free_reason(s.id) as free_reason
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
             'low_count', response_count < public.point_rule('low_response_warning')
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

-- 전체 결과: 등록자가 비면 "내 설문"이 null이 되어 열람 확인을 건너뛰는 구멍 → coalesce로 false
create or replace function public.get_full_results(p_survey_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_survey public.surveys%rowtype;
  v_ids bigint[];
  v_all integer;
  v_mine boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_survey from public.surveys where id = p_survey_id;
  if not found then
    raise exception 'survey_not_found';
  end if;
  v_mine := coalesce(v_survey.owner_id = v_uid, false);
  if not v_mine
     and not exists (select 1 from public.survey_views where survey_id = p_survey_id and user_id = v_uid) then
    raise exception 'not_viewed';
  end if;

  v_ids := public.survey_valid_ids(p_survey_id);
  select count(*) into v_all from public.responses where survey_id = p_survey_id;

  return jsonb_build_object(
    'total', cardinality(v_ids),
    'excluded', v_all - cardinality(v_ids),
    'pass_rate', case when v_all = 0 then null else round(100.0 * cardinality(v_ids) / v_all) end,
    'avg_seconds', (select round(avg(duration_seconds)) from public.responses
                     where id = any (v_ids) and duration_seconds is not null),
    'started_at', v_survey.created_at,
    'ended_at', coalesce(v_survey.closes_at, now()),
    'view_count', (select count(*) from public.survey_views where survey_id = p_survey_id),
    'share_earned', case when v_mine then (
      select coalesce(sum(amount), 0) from public.point_ledger
       where user_id = v_uid and reason = 'data_share' and ref_id like p_survey_id || ':%') end,
    'overall', public.question_stats(p_survey_id, v_ids),
    'groups', jsonb_build_object(
      'major',  public.survey_groups(p_survey_id, v_ids, 'major', true),
      'grade',  public.survey_groups(p_survey_id, v_ids, 'grade', true),
      'gender', public.survey_groups(p_survey_id, v_ids, 'gender', true),
      'age',    public.survey_groups(p_survey_id, v_ids, 'age', true)
    )
  );
end;
$$;

-- 열람: 등록자가 탈퇴했으면 등록자 몫은 건너뛴다 (받을 사람 없음)
create or replace function public.view_survey(p_survey_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_survey public.surveys%rowtype;
  v_profile public.profiles%rowtype;
  v_reason text;
  v_cost integer := 0;
  v_balance integer;
  v_share integer;
  v_view_id bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_survey from public.surveys where id = p_survey_id;
  if not found then
    raise exception 'survey_not_found';
  end if;
  if v_survey.owner_id = v_uid then
    return jsonb_build_object('paid', 0, 'free_reason', 'owner');
  end if;

  -- 회원정보 행을 잠근다: 열람이 동시에 와도 하나씩 처리 (중복 차감·음수 잔액 방지)
  select * into v_profile from public.profiles where id = v_uid for update;

  if exists (select 1 from public.survey_views where survey_id = p_survey_id and user_id = v_uid) then
    return jsonb_build_object('paid', 0, 'free_reason', 'already');
  end if;
  if not public.survey_listed(p_survey_id, v_uid) then
    raise exception 'not_listed';
  end if;

  v_reason := coalesce(
    public.survey_free_reason(p_survey_id),
    -- TODO(임시): 단체는 테스트 동안 무료 · Q14 답이 오면 변경
    case when v_profile.account_type = 'org' then 'org' end,
    case when v_profile.account_type = 'student'
           and not exists (select 1 from public.survey_views where user_id = v_uid and free_reason = 'welcome')
         then 'welcome' end,
    'paid');

  if v_reason = 'paid' then
    v_cost := public.point_rule('cost_data_view');
    select coalesce(sum(amount), 0)::integer into v_balance
      from public.point_ledger where user_id = v_uid and status = 'confirmed';
    if v_balance < v_cost then
      raise exception 'insufficient_points';
    end if;
  end if;

  insert into public.survey_views (survey_id, user_id, paid, free_reason)
  values (p_survey_id, v_uid, v_cost, v_reason)
  returning id into v_view_id;

  if v_cost > 0 then
    insert into public.point_ledger (user_id, amount, status, reason, ref_id)
    values (v_uid, -v_cost, 'confirmed', 'data_view', p_survey_id::text);

    -- 등록자 몫. ref_id = "설문번호:열람번호" (열람한 사람이 누군지는 남기지 않는다). 탈퇴한 등록자면 건너뜀
    v_share := floor(v_cost * public.point_rule('data_share_rate'))::integer;
    if v_share > 0 and v_survey.owner_id is not null then
      insert into public.point_ledger (user_id, amount, status, reason, ref_id)
      values (v_survey.owner_id, v_share, 'confirmed', 'data_share', p_survey_id || ':' || v_view_id);
    end if;
  end if;

  return jsonb_build_object('paid', v_cost, 'free_reason', v_reason);
end;
$$;

-- =========================================================
-- 4. 웰컴 포인트는 메일 하나당 한 번만
-- =========================================================
-- 메일 주소 대신 되돌릴 수 없게 바꾼 값(SHA-256)만 보관. 앱에서는 읽을 수 없다
create table public.welcomed_emails (
  email_hash text primary key,
  created_at timestamptz not null default now()
);

alter table public.welcomed_emails enable row level security;
revoke all on public.welcomed_emails from anon, authenticated;

-- 이미 웰컴을 받은 메일이면 웰컴 포인트 기록을 조용히 건너뛴다 (가입은 그대로 진행)
create function public.welcome_once()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
begin
  if new.reason <> 'welcome' then
    return new;
  end if;
  select encode(sha256(convert_to(lower(email), 'UTF8')), 'hex') into v_hash
    from auth.users where id = new.user_id;
  if v_hash is null then
    return new;
  end if;
  insert into public.welcomed_emails (email_hash) values (v_hash) on conflict do nothing;
  if not found then
    return null;
  end if;
  return new;
end;
$$;

revoke execute on function public.welcome_once() from public, anon, authenticated;

create trigger point_ledger_welcome_once
  before insert on public.point_ledger
  for each row execute function public.welcome_once();

-- 이미 웰컴을 받은 회원들의 메일도 기록
insert into public.welcomed_emails (email_hash)
select distinct encode(sha256(convert_to(lower(u.email), 'UTF8')), 'hex')
  from public.point_ledger l
  join auth.users u on u.id = l.user_id
 where l.reason = 'welcome' and u.email is not null
on conflict do nothing;

-- =========================================================
-- 5. delete_my_account: 회원 탈퇴
-- =========================================================
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  perform 1 from public.profiles where id = v_uid for update;

  -- "나만 보기" 설문은 삭제 (문항·응답·답변·열람 기록이 함께 지워짐)
  delete from public.surveys where owner_id = v_uid and result_visibility = 'private';
  -- 진행 중인 설문은 마감 (마감일은 surveys_set_closed_at 트리거가 지금으로)
  update public.surveys set status = 'closed' where owner_id = v_uid and status = 'open';

  -- 계정 삭제 → 회원정보·포인트 기록·신고·단체 정보는 함께 삭제,
  --             응답·설문·열람 기록은 사람 연결만 비워져 남는다
  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
