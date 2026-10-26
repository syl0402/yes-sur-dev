-- 단체 계정 가입
-- 1) profiles: 회원 종류를 student / org로 정리, 닉네임은 학생만 필수
-- 2) organizations: 단체 정보 (단체 계정 1개당 1줄)
-- 3) request_org_signup: 단체 신청·재신청 서버 함수 (포인트 지급 없음)
-- 운영자 승인: Table Editor → profiles.approval_status를 approved / rejected로,
--              거절이면 organizations.reject_reason에 사유
-- 적용: Supabase 대시보드 → SQL Editor에 전체를 붙여넣고 Run

-- =========================================================
-- 1. profiles
-- =========================================================
-- 회원 종류: 기업은 따로 두지 않고 단체(org)의 종류 "외부"로 다룬다
alter table public.profiles drop constraint profiles_account_type_check;
alter table public.profiles
  add constraint profiles_account_type_check check (account_type in ('student', 'org'));

-- 단체 계정은 닉네임 대신 단체 이름을 쓴다
alter table public.profiles alter column nickname drop not null;
alter table public.profiles
  add constraint profiles_student_nickname_check
  check (account_type <> 'student' or nickname is not null);

-- =========================================================
-- 2. organizations: 단체 정보
-- =========================================================
create table public.organizations (
  id uuid primary key references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('campus', 'external')),
  name text not null,
  university_id bigint references public.universities (id),
  evidence_url text not null,
  description text,
  reject_reason text,
  created_at timestamptz not null default now(),
  -- 교내 단체는 학교가 필수
  check (kind <> 'campus' or university_id is not null),
  -- 같은 학교 안에서 같은 이름 금지 (외부 단체는 학교가 비어 있어 외부끼리 이름 중복 금지)
  unique nulls not distinct (university_id, name)
);

alter table public.organizations enable row level security;

create policy "본인 단체 정보만 읽을 수 있다"
  on public.organizations for select
  to authenticated
  using ((select auth.uid()) = id);

revoke all on public.organizations from anon, authenticated;
grant select on public.organizations to authenticated;

-- =========================================================
-- 3. request_org_signup: 단체 신청 (거절된 경우 재신청)
-- =========================================================
create function public.request_org_signup(
  p_kind text,
  p_name text,
  p_university_id bigint,
  p_evidence_url text,
  p_description text,
  p_terms_agreed boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed_at timestamptz;
  v_account_type text;
  v_status text;
  v_name text := btrim(p_name);
  v_evidence_url text := btrim(p_evidence_url);
  v_description text := nullif(btrim(p_description), '');
  v_university_id bigint;
begin
  -- 1. 로그인 확인
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- 2. 이메일 인증 확인 (단체는 아무 메일 가능, 도메인 검사 없음)
  select email, email_confirmed_at
    into v_email, v_confirmed_at
    from auth.users
   where id = v_uid;

  if v_email is null or v_confirmed_at is null then
    raise exception 'email_not_verified';
  end if;

  -- 3. 이미 가입한 계정인지
  select account_type, approval_status
    into v_account_type, v_status
    from public.profiles
   where id = v_uid;

  if v_account_type = 'student' then
    raise exception 'already_student';
  end if;

  -- 대기·승인 상태면 아무것도 하지 않는다 (버튼 연타·재시도 대비). 거절이면 아래에서 재신청
  if v_account_type = 'org' and v_status in ('pending', 'approved') then
    return;
  end if;

  -- 4. 입력 검사
  if p_terms_agreed is not true then
    raise exception 'terms_not_agreed';
  end if;

  if p_kind is null or p_kind not in ('campus', 'external') then
    raise exception 'invalid_org_kind';
  end if;

  if v_name is null or char_length(v_name) not between 2 and 30 then
    raise exception 'invalid_org_name';
  end if;

  if p_kind = 'campus' then
    if p_university_id is null
       or not exists (select 1 from public.universities where id = p_university_id) then
      raise exception 'invalid_org_university';
    end if;
    v_university_id := p_university_id;
  else
    v_university_id := null;
  end if;

  if v_evidence_url is null
     or v_evidence_url !~* '^https?://'
     or char_length(v_evidence_url) > 300 then
    raise exception 'invalid_org_evidence';
  end if;

  if v_description is not null and char_length(v_description) > 200 then
    raise exception 'invalid_org_description';
  end if;

  -- 5. 저장 (포인트 지급 없음)
  begin
    if v_account_type is null then
      -- 처음 신청
      insert into public.profiles (id, account_type, approval_status, university_id, terms_agreed_at)
      values (v_uid, 'org', 'pending', v_university_id, now())
      on conflict (id) do nothing;

      insert into public.organizations (id, kind, name, university_id, evidence_url, description)
      values (v_uid, p_kind, v_name, v_university_id, v_evidence_url, v_description)
      on conflict (id) do nothing;
    else
      -- 거절된 뒤 재신청: 내용을 고치고 다시 대기로
      update public.profiles
         set approval_status = 'pending',
             university_id = v_university_id,
             terms_agreed_at = now()
       where id = v_uid;

      update public.organizations
         set kind = p_kind,
             name = v_name,
             university_id = v_university_id,
             evidence_url = v_evidence_url,
             description = v_description,
             reject_reason = null
       where id = v_uid;
    end if;
  exception
    when unique_violation then
      raise exception 'org_name_taken';
  end;
end;
$$;

revoke execute on function public.request_org_signup(text, text, bigint, text, text, boolean) from public, anon;
grant execute on function public.request_org_signup(text, text, bigint, text, text, boolean) to authenticated;
