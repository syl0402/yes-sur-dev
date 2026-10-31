-- 학교 하나에 메일 주소 여러 개 (2026-10-31)
--
-- 서울 주요 대학을 추가하면서 확인: 학교마다 학생 메일 주소가 둘 이상인 경우가 많다
-- (예: 포털 메일 + 학생용 구글 메일). universities.email_domain은 하나뿐이라
-- university_domains 표를 두고, 가입할 때 이 표에서 학교를 찾는다.
-- universities.email_domain은 "대표 주소"로 그대로 둔다 (예전 화면·코드 호환)
-- 학교 추가는 supabase/seed/universities.sql

create table public.university_domains (
  domain text primary key check (domain = lower(domain) and position('@' in domain) = 0 and char_length(domain) between 3 and 100),
  university_id bigint not null references public.universities (id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index university_domains_university_idx on public.university_domains (university_id);

-- 기존 학교의 대표 주소를 옮긴다
insert into public.university_domains (domain, university_id, is_primary)
select lower(email_domain), id, true from public.universities
on conflict (domain) do nothing;

alter table public.university_domains enable row level security;

-- 학교 이름·메일 주소는 공개 정보. 가입 첫 화면(로그인 전)에서도 읽는다
create policy "누구나 학교 메일 주소를 읽을 수 있다"
  on public.university_domains for select
  to anon, authenticated
  using (true);

revoke all on public.university_domains from anon, authenticated;
grant select on public.university_domains to anon, authenticated;

-- 가입 완료: 학교 찾기를 university_domains로 (나머지는 20261030000007과 같음)
create or replace function public.complete_signup(
  p_nickname text,
  p_major_field_id bigint,
  p_admission_year integer,
  p_degree_type text,
  p_terms_agreed boolean,
  p_gender text,
  p_birth_year integer
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
  v_university_id bigint;
  v_nickname text := btrim(p_nickname);
  v_welcome integer;
begin
  -- 1. 로그인 확인
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- 2. 이메일 인증 확인
  select email, email_confirmed_at
    into v_email, v_confirmed_at
    from auth.users
   where id = v_uid;

  if v_email is null or v_confirmed_at is null then
    raise exception 'email_not_verified';
  end if;

  -- 3. 허용 학교 도메인인지 확인 (개인 메일 차단)
  select university_id
    into v_university_id
    from public.university_domains
   where domain = lower(split_part(v_email, '@', 2));

  if v_university_id is null then
    raise exception 'domain_not_allowed';
  end if;

  -- 4. 이미 가입을 마쳤으면 아무것도 하지 않는다 (버튼 연타·재시도 대비)
  if exists (select 1 from public.profiles where id = v_uid) then
    return;
  end if;

  -- 5. 입력 검사
  if p_terms_agreed is not true then
    raise exception 'terms_not_agreed';
  end if;

  if v_nickname is null or char_length(v_nickname) not between 2 and 12 then
    raise exception 'invalid_nickname';
  end if;

  if p_major_field_id is null
     or not exists (select 1 from public.major_fields where id = p_major_field_id) then
    raise exception 'invalid_major_field';
  end if;

  if p_degree_type is null or p_degree_type not in ('undergrad', 'grad') then
    raise exception 'invalid_degree_type';
  end if;

  if p_admission_year is null
     or p_admission_year not between 2000 and extract(year from now())::integer then
    raise exception 'invalid_admission_year';
  end if;

  perform public.check_demographics(p_gender, p_birth_year);

  -- 6. 웰컴 금액은 point_rules에서 읽는다 (코드에 숫자를 쓰지 않는다)
  select value::integer
    into v_welcome
    from public.point_rules
   where key = 'welcome';

  if v_welcome is null then
    raise exception 'rule_missing';
  end if;

  -- 7. 회원정보 저장
  begin
    insert into public.profiles
      (id, account_type, approval_status, university_id, nickname, major_field_id,
       admission_year, degree_type, terms_agreed_at, gender, birth_year)
    values
      (v_uid, 'student', 'approved', v_university_id, v_nickname, p_major_field_id,
       p_admission_year, p_degree_type, now(), p_gender, p_birth_year)
    on conflict (id) do nothing;
  exception
    when unique_violation then
      raise exception 'nickname_taken';
  end;

  -- 8. 웰컴 포인트 지급 (고유 제약으로 사람당 1번만)
  insert into public.point_ledger (user_id, amount, status, reason, ref_id)
  values (v_uid, v_welcome, 'confirmed', 'welcome', null)
  on conflict do nothing;
end;
$$;

