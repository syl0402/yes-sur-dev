-- 신고 기능 (2026-10-30)
--
-- 사용자가 올린 글(지금은 설문)을 신고 → 서로 다른 n명이 신고하면 자동 숨김 → 운영자가 확인.
-- 스토어 심사: 사용자 콘텐츠가 있는 앱은 신고·운영자 조치가 필요하다.
-- reports 표는 target_type으로 나중에 커뮤니티 글·댓글·밸런스 투표도 받을 수 있게 둔다.
--
-- 운영자 처리 (Table Editor):
--   reports에서 신고를 보고 → surveys.moderation을 'visible'(되살리기) 또는 'removed'(삭제)로,
--   reports.status를 'kept'(문제없음) 또는 'removed'(조치함)로 바꾼다.
-- 포인트: 이미 준 응답 보상은 그대로, 숨김·삭제된 설문의 등록비는 돌려주지 않는다.

-- =========================================================
-- 1. 설정값
-- =========================================================
insert into public.point_rules (key, value, description) values
  ('report_hide_count', 3, '서로 다른 사람 이만큼 신고하면 자동 숨김');

-- =========================================================
-- 2. 설문 검토 상태: visible 보임 / hidden 신고로 숨김(운영자 확인 전) / removed 운영자가 삭제
-- =========================================================
alter table public.surveys
  add column moderation text not null default 'visible'
    check (moderation in ('visible', 'hidden', 'removed'));

-- =========================================================
-- 3. reports: 신고 기록
-- =========================================================
create table public.reports (
  id bigint generated always as identity primary key,
  -- 신고 대상 종류. 지금은 설문만 (커뮤니티가 생기면 늘린다)
  target_type text not null check (target_type in ('survey')),
  target_id bigint not null,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('spam', 'abuse', 'privacy', 'sexual', 'other')),
  detail text check (char_length(detail) <= 200),
  -- pending 확인 전 / kept 문제없음 / removed 조치함
  status text not null default 'pending' check (status in ('pending', 'kept', 'removed')),
  created_at timestamptz not null default now(),
  -- 한 사람이 같은 대상을 한 번만
  unique (target_type, target_id, reporter_id)
);

alter table public.reports enable row level security;

create policy "본인 신고만 읽을 수 있다"
  on public.reports for select
  to authenticated
  using (reporter_id = (select auth.uid()));

revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;

-- =========================================================
-- 4. report_survey: 설문 신고
-- =========================================================
create function public.report_survey(p_survey_id bigint, p_reason text, p_detail text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select owner_id into v_owner from public.surveys where id = p_survey_id for update;
  if not found then
    raise exception 'survey_not_found';
  end if;
  if v_owner = v_uid then
    raise exception 'report_own_survey';
  end if;
  if p_reason is null or p_reason not in ('spam', 'abuse', 'privacy', 'sexual', 'other') then
    raise exception 'invalid_reason';
  end if;

  begin
    insert into public.reports (target_type, target_id, reporter_id, reason, detail)
    values ('survey', p_survey_id, v_uid, p_reason, nullif(left(btrim(coalesce(p_detail, '')), 200), ''));
  exception when unique_violation then
    raise exception 'already_reported';
  end;

  -- 확인 전(pending) 신고자 수가 기준 이상이면 숨김.
  -- 운영자가 되살리며 신고를 kept로 바꾸면, 그 뒤 새 신고만 다시 센다
  select count(*) into v_count
    from public.reports
   where target_type = 'survey' and target_id = p_survey_id and status = 'pending';
  if v_count >= public.point_rule('report_hide_count') then
    update public.surveys set moderation = 'hidden'
     where id = p_survey_id and moderation = 'visible';
  end if;
end;
$$;

revoke execute on function public.report_survey(bigint, text, text) from public, anon;
grant execute on function public.report_survey(bigint, text, text) to authenticated;

-- =========================================================
-- 5. 숨김 반영
-- =========================================================

-- 설문 읽기: 작성자는 항상, 다른 사람은 보이는 설문 중 응답 대상인 것만
drop policy "응답 대상이거나 작성자면 설문을 읽을 수 있다" on public.surveys;
create policy "응답 대상이거나 작성자면 설문을 읽을 수 있다"
  on public.surveys for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or (
      moderation = 'visible'
      and (
        audience = 'all'
        or (
          audience = 'campus'
          and university_id = (
            select p.university_id from public.profiles p where p.id = (select auth.uid())
          )
        )
      )
    )
  );

-- 데이터 허브: 숨긴 설문은 작성자 말고는 안 보인다
create or replace function public.survey_listed(p_survey_id bigint, p_uid uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
           when s.owner_id = p_uid then true
           when s.moderation <> 'visible' then false
           when s.result_visibility = 'private' then false
           when s.result_visibility = 'campus'
                and s.result_university_id is distinct from (select university_id from public.profiles where id = p_uid)
             then false
           else (s.status <> 'open' or (s.closes_at is not null and s.closes_at <= now()))
                and s.response_count >= public.point_rule('result_min_count')
         end
    from public.surveys s
   where s.id = p_survey_id;
$$;

-- 숨긴 설문에는 새 응답을 받지 않는다 (화면을 열어 둔 채 제출하는 경우)
create function public.check_survey_visible()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.surveys where id = new.survey_id and moderation <> 'visible') then
    raise exception 'survey_hidden';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_survey_visible() from public, anon, authenticated;

create trigger responses_check_visible
  before insert on public.responses
  for each row execute function public.check_survey_visible();
