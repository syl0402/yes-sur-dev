-- 학과 자유 입력 → 표준 전공 계열 선택
-- 1) major_fields 표(대계열 7 → 중계열 35, 한국교육개발원 학과 분류 기준)
-- 2) profiles.department 삭제, major_field_id 추가
-- 3) complete_signup: p_department → p_major_field_id
-- 적용 전: profiles의 테스트 회원을 지운다 (department 칸이 삭제되므로)
-- 적용: Supabase 대시보드 → SQL Editor에 전체를 붙여넣고 Run

-- =========================================================
-- 1. major_fields: 전국 공통 전공 계열 목록
-- 공개 통계는 대계열(category), 타기팅은 중계열(name)까지 쓴다
-- =========================================================
create table public.major_fields (
  id bigint generated always as identity primary key,
  category text not null
    check (category in ('humanities', 'social', 'education', 'engineering', 'natural', 'medical', 'arts')),
  category_name text not null,
  name text not null,
  sort_order integer not null,
  unique (category, name)
);

insert into public.major_fields (category, category_name, name, sort_order) values
  ('humanities',  '인문',   '언어·문학',            1),
  ('humanities',  '인문',   '인문과학',             2),
  ('social',      '사회',   '경영·경제',            3),
  ('social',      '사회',   '법률',                 4),
  ('social',      '사회',   '사회과학',             5),
  ('education',   '교육',   '교육일반',             6),
  ('education',   '교육',   '유아교육',             7),
  ('education',   '교육',   '특수교육',             8),
  ('education',   '교육',   '초등교육',             9),
  ('education',   '교육',   '중등교육',            10),
  ('engineering', '공학',   '건축',                11),
  ('engineering', '공학',   '토목·도시',           12),
  ('engineering', '공학',   '교통·운송',           13),
  ('engineering', '공학',   '기계·금속',           14),
  ('engineering', '공학',   '전기·전자',           15),
  ('engineering', '공학',   '정밀·에너지',         16),
  ('engineering', '공학',   '소재·재료',           17),
  ('engineering', '공학',   '컴퓨터·통신',         18),
  ('engineering', '공학',   '산업',                19),
  ('engineering', '공학',   '화공',                20),
  ('engineering', '공학',   '공학 기타',           21),
  ('natural',     '자연',   '농림·수산',           22),
  ('natural',     '자연',   '생물·화학·환경',      23),
  ('natural',     '자연',   '생활과학',            24),
  ('natural',     '자연',   '수학·물리·천문·지리', 25),
  ('medical',     '의약',   '의료',                26),
  ('medical',     '의약',   '간호',                27),
  ('medical',     '의약',   '약학',                28),
  ('medical',     '의약',   '치료·보건',           29),
  ('arts',        '예체능', '디자인',              30),
  ('arts',        '예체능', '응용예술',            31),
  ('arts',        '예체능', '무용·체육',           32),
  ('arts',        '예체능', '미술·조형',           33),
  ('arts',        '예체능', '연극·영화',           34),
  ('arts',        '예체능', '음악',                35);

alter table public.major_fields enable row level security;

create policy "로그인한 사람은 전공 계열 목록을 읽을 수 있다"
  on public.major_fields for select
  to authenticated
  using (true);

revoke all on public.major_fields from anon, authenticated;
grant select on public.major_fields to authenticated;

-- =========================================================
-- 2. profiles: 학과(자유 입력) 대신 전공 계열
-- =========================================================
alter table public.profiles drop column department;

alter table public.profiles
  add column major_field_id bigint references public.major_fields (id);

-- =========================================================
-- 3. complete_signup: p_department → p_major_field_id
-- 매개변수가 바뀌어 기존 함수를 지우고 새로 만든다
-- =========================================================
drop function public.complete_signup(text, text, integer, text, boolean);

create function public.complete_signup(
  p_nickname text,
  p_major_field_id bigint,
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
       admission_year, degree_type, terms_agreed_at)
    values
      (v_uid, 'student', 'approved', v_university_id, v_nickname, p_major_field_id,
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

revoke execute on function public.complete_signup(text, bigint, integer, text, boolean) from public, anon;
grant execute on function public.complete_signup(text, bigint, integer, text, boolean) to authenticated;
