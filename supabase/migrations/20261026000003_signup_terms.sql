-- DB 3단계: 가입 화면 준비
-- 1) 약관 동의 시각 저장  2) 학년 → 입학년도  3) 로그인 전에도 학교 목록 읽기
-- 4) complete_signup 매개변수 변경
-- 적용: Supabase 대시보드 → SQL Editor에 전체를 붙여넣고 Run

-- =========================================================
-- 1·2. profiles: 학년 대신 입학년도, 약관 동의 시각 추가
-- (적용 시점에 profiles는 비어 있다)
-- =========================================================
alter table public.profiles drop column grade;

alter table public.profiles
  add column admission_year smallint,
  add column terms_agreed_at timestamptz;

-- =========================================================
-- 3. universities: 가입 첫 화면(로그인 전)에서 학교 목록이 필요하다
-- 학교 이름과 도메인은 공개 정보라 읽기만 허용한다
-- =========================================================
grant select on public.universities to anon;

create policy "로그인 전에도 학교 목록을 읽을 수 있다"
  on public.universities for select
  to anon
  using (true);

-- =========================================================
-- 4. complete_signup: p_grade → p_admission_year, p_terms_agreed 추가
-- 매개변수가 바뀌어 기존 함수를 지우고 새로 만든다
-- =========================================================
drop function public.complete_signup(text, text, integer, text);

create function public.complete_signup(
  p_nickname text,
  p_department text,
  p_admission_year integer,
  p_degree_type text,
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
  v_university_id bigint;
  v_nickname text := btrim(p_nickname);
  v_department text := btrim(p_department);
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
  select id
    into v_university_id
    from public.universities
   where email_domain = lower(split_part(v_email, '@', 2));

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

  if v_department is null or v_department = '' then
    raise exception 'invalid_department';
  end if;

  if p_degree_type is null or p_degree_type not in ('undergrad', 'grad') then
    raise exception 'invalid_degree_type';
  end if;

  if p_admission_year is null
     or p_admission_year not between 2000 and extract(year from now())::integer then
    raise exception 'invalid_admission_year';
  end if;

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
      (id, account_type, approval_status, university_id, nickname, department,
       admission_year, degree_type, terms_agreed_at)
    values
      (v_uid, 'student', 'approved', v_university_id, v_nickname, v_department,
       p_admission_year, p_degree_type, now())
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

revoke execute on function public.complete_signup(text, text, integer, text, boolean) from public, anon;
grant execute on function public.complete_signup(text, text, integer, text, boolean) to authenticated;
