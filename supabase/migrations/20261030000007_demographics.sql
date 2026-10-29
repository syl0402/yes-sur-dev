-- 응답자 정보 추가: 성별·출생연도 (2026-10-30)
--
-- 데이터 허브의 나눠 보기(성별·나이대)에 쓴다. 결과에는 묶어서만 나온다 (5명 미만 그룹 숨김).
-- - gender: male / female / undisclosed(선택 안 함). 비어 있음 = 아직 안 받음(기존 회원)
-- - birth_year: 출생연도만 받는다 (생년월일은 받지 않음 — 최소 수집). 학생은 가입 때 필수
-- 기존 회원은 마이 탭 "내 정보"에서 update_my_demographics로 입력한다
-- ⚠️ 개인정보처리방침(Q11)에 수집 항목(성별·출생연도) 추가 필요

-- =========================================================
-- 1. 칸 추가
-- =========================================================
alter table public.profiles
  add column gender text check (gender in ('male', 'female', 'undisclosed')),
  add column birth_year integer check (birth_year between 1900 and 2100);

-- =========================================================
-- 2. 입력 검사 도우미 (가입·수정이 같은 규칙을 쓴다)
-- 출생연도: 올해 기준 만 14세 ~ 60세쯤 (대학생·대학원생 범위)
-- =========================================================
create function public.check_demographics(p_gender text, p_birth_year integer)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_year integer := extract(year from now())::integer;
begin
  if coalesce(p_gender, '') not in ('male', 'female', 'undisclosed') then
    raise exception 'invalid_gender';
  end if;
  if p_birth_year is null or p_birth_year not between v_year - 60 and v_year - 14 then
    raise exception 'invalid_birth_year';
  end if;
end;
$$;

revoke execute on function public.check_demographics(text, integer) from public, anon, authenticated;

-- =========================================================
-- 3. update_my_demographics: 본인 성별·출생연도 입력·수정 (기존 회원용, 학생만)
-- =========================================================
create function public.update_my_demographics(p_gender text, p_birth_year integer)
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
  if not exists (select 1 from public.profiles where id = v_uid and account_type = 'student') then
    raise exception 'not_student';
  end if;

  perform public.check_demographics(p_gender, p_birth_year);

  update public.profiles
     set gender = p_gender, birth_year = p_birth_year
   where id = v_uid;
end;
$$;

revoke execute on function public.update_my_demographics(text, integer) from public, anon;
grant execute on function public.update_my_demographics(text, integer) to authenticated;

-- =========================================================
-- 4. complete_signup: 성별·출생연도를 함께 받는다 (매개변수가 늘어서 지우고 다시 만든다)
-- 20261027000001과 같고, 검사·저장에 두 항목만 추가
-- =========================================================
drop function public.complete_signup(text, bigint, integer, text, boolean);

create function public.complete_signup(
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

revoke execute on function public.complete_signup(text, bigint, integer, text, boolean, text, integer) from public, anon;
grant execute on function public.complete_signup(text, bigint, integer, text, boolean, text, integer) to authenticated;
