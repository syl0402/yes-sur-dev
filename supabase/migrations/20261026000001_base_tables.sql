-- DB 기초 1단계: 학교 · 회원정보 · 포인트 규칙 · 포인트 기록
-- 적용: Supabase 대시보드 → SQL Editor에 전체를 붙여넣고 Run

-- =========================================================
-- 1. universities: 가입을 허용하는 학교와 이메일 도메인
-- =========================================================
create table public.universities (
  id bigint generated always as identity primary key,
  name text not null,
  email_domain text not null unique,
  created_at timestamptz not null default now()
);

insert into public.universities (name, email_domain) values
  ('중앙대학교', 'cau.ac.kr');

alter table public.universities enable row level security;

create policy "로그인한 사람은 학교 목록을 읽을 수 있다"
  on public.universities for select
  to authenticated
  using (true);

-- =========================================================
-- 2. profiles: 회원정보 (이메일은 넣지 않는다. Supabase Auth에만 있다)
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  account_type text not null default 'student'
    check (account_type in ('student', 'org', 'company')),
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  role text not null default 'user'
    check (role in ('user', 'admin')),
  university_id bigint references public.universities (id),
  nickname text not null unique,
  department text,
  grade smallint,
  degree_type text,
  created_at timestamptz not null default now(),
  -- 학생은 반드시 학교가 있어야 한다
  check (account_type <> 'student' or university_id is not null)
);

alter table public.profiles enable row level security;

create policy "본인 회원정보만 읽을 수 있다"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

-- 쓰기 정책은 만들지 않는다. 가입·수정은 서버 함수로만 한다.

-- =========================================================
-- 3. point_rules: 모든 포인트 수치 (코드에 숫자를 쓰지 않는다)
-- =========================================================
create table public.point_rules (
  key text primary key,
  value numeric not null,
  description text not null
);

insert into public.point_rules (key, value, description) values
  ('welcome',            500,  '가입 웰컴'),
  ('reward_1q',          50,   '1문항 설문 응답'),
  ('reward_lt5',         300,  '5분 미만 설문 응답'),
  ('reward_5to15',       1000, '5~15분 설문 응답'),
  ('reward_gte15',       3000, '15분 이상 설문 응답'),
  ('cost_survey_create', 700,  '설문 등록'),
  ('cost_data_view',     500,  '데이터 열람 (1문항 설문은 0)'),
  ('balance_vote',       50,   '밸런스 투표'),
  ('balance_daily_cap',  10,   '밸런스 투표 보상 하루 최대 횟수'),
  ('early_bird_rate',    0.10, '오픈 24시간 내 응답 추가 비율'),
  ('result_min_count',   5,    '공개 결과를 보여주는 최소 응답 수');

alter table public.point_rules enable row level security;

create policy "로그인한 사람은 포인트 규칙을 읽을 수 있다"
  on public.point_rules for select
  to authenticated
  using (true);

-- =========================================================
-- 4. point_ledger: 포인트 기록 (잔액 = confirmed 합계, 잔액 칸 없음)
-- =========================================================
create table public.point_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount <> 0),
  status text not null default 'confirmed'
    check (status in ('pending', 'confirmed', 'rejected', 'revoked')),
  reason text not null
    check (reason in ('welcome', 'survey_reward', 'survey_create', 'data_view', 'balance_vote')),
  ref_id text,
  created_at timestamptz not null default now(),
  -- 중복 지급 방지: 같은 사람·같은 이유·같은 대상은 한 번만
  -- (웰컴은 ref_id가 비어 있으므로 사람당 1번)
  unique nulls not distinct (user_id, reason, ref_id)
);

alter table public.point_ledger enable row level security;

create policy "본인 포인트 기록만 읽을 수 있다"
  on public.point_ledger for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- =========================================================
-- 5. 권한: 앱(anon, authenticated)은 읽기만. 쓰기는 서버 함수로만
-- =========================================================
revoke all on public.universities, public.profiles, public.point_rules, public.point_ledger
  from anon, authenticated;

grant select on public.universities, public.profiles, public.point_rules, public.point_ledger
  to authenticated;

-- =========================================================
-- 6. get_my_balance(): 로그인한 본인의 잔액
-- =========================================================
create function public.get_my_balance()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(amount), 0)::integer
  from public.point_ledger
  where user_id = (select auth.uid())
    and status = 'confirmed';
$$;

revoke execute on function public.get_my_balance() from public, anon;
grant execute on function public.get_my_balance() to authenticated;
