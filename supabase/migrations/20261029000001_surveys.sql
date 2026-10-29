-- 설문 1단계: 설문·문항·선택지·응답·답변 표 + 보상 계산 + 응답 제출 함수
-- 결정 (docs/PROGRESS.md "결정: 설문 1단계"):
--   보상은 플랫폼이 소요시간으로 자동 지급, 금액은 설문 등록 때 서버가 계산해 저장
--   응답 대상 = 전체 / 우리 학교만 (대상이 아니면 응답 목록에서 안 보임)
--   결과 공개 범위는 별개 → 2단계(공개 설정)·데이터 허브에서 별도 함수로 열람
--   목표 응답 수에 도달하면 자동 마감
-- 적용: Supabase 대시보드 → SQL Editor에 전체를 붙여넣고 Run

-- =========================================================
-- 1. survey_categories: 설문 카테고리 (코드 수정 없이 바꿀 수 있게 표로)
-- =========================================================
create table public.survey_categories (
  id bigint generated always as identity primary key,
  key text not null unique,
  name text not null,
  sort_order integer not null
);

insert into public.survey_categories (key, name, sort_order) values
  ('study',     '학업',     1),
  ('life',      '생활',     2),
  ('consume',   '소비',     3),
  ('taste',     '취향',     4),
  ('community', '커뮤니티', 5);

alter table public.survey_categories enable row level security;

create policy "로그인한 사람은 카테고리를 읽을 수 있다"
  on public.survey_categories for select
  to authenticated
  using (true);

-- =========================================================
-- 2. surveys: 설문
-- 단체 설문은 단체 계정이 곧 작성자라 별도 단체 칸이 없다
-- =========================================================
create table public.surveys (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  category_id bigint not null references public.survey_categories (id),
  title text not null,
  description text,
  question_count integer not null check (question_count > 0),
  est_minutes integer not null check (est_minutes > 0),
  -- 응답 1건당 보상. 등록 때 서버가 point_rules로 계산해 저장한다 (나중에 규칙이 바뀌어도 약속은 유지)
  reward_points integer not null check (reward_points >= 0),
  target_responses integer not null check (target_responses > 0),
  response_count integer not null default 0 check (response_count >= 0),
  -- 응답 대상: all 전체 / campus 우리 학교만
  audience text not null default 'all' check (audience in ('all', 'campus')),
  university_id bigint references public.universities (id),
  status text not null default 'open' check (status in ('open', 'closed')),
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  check (audience <> 'campus' or university_id is not null)
);

alter table public.surveys enable row level security;

-- 응답 목록에는 내가 응답할 수 있는 대상의 설문만 보인다. 작성자는 자기 설문을 항상 본다
create policy "응답 대상이거나 작성자면 설문을 읽을 수 있다"
  on public.surveys for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or audience = 'all'
    or (
      audience = 'campus'
      and university_id = (
        select p.university_id from public.profiles p where p.id = (select auth.uid())
      )
    )
  );

-- =========================================================
-- 3. questions / question_options: 문항과 선택지
-- 1단계는 단일 선택(single)만 쓴다. 나머지 종류는 2단계용으로 미리 허용
-- =========================================================
create table public.questions (
  id bigint generated always as identity primary key,
  survey_id bigint not null references public.surveys (id) on delete cascade,
  sort_order integer not null,
  type text not null default 'single' check (type in ('single', 'multi', 'scale', 'text')),
  text text not null,
  is_attention_check boolean not null default false,
  correct_option_id bigint,
  unique (survey_id, sort_order)
);

create table public.question_options (
  id bigint generated always as identity primary key,
  question_id bigint not null references public.questions (id) on delete cascade,
  sort_order integer not null,
  text text not null,
  unique (question_id, sort_order)
);

alter table public.questions enable row level security;
alter table public.question_options enable row level security;

-- 설문을 볼 수 있으면 그 문항·선택지도 볼 수 있다 (surveys의 권한을 그대로 따른다)
create policy "볼 수 있는 설문의 문항을 읽을 수 있다"
  on public.questions for select
  to authenticated
  using (exists (select 1 from public.surveys s where s.id = survey_id));

create policy "볼 수 있는 문항의 선택지를 읽을 수 있다"
  on public.question_options for select
  to authenticated
  using (exists (select 1 from public.questions q where q.id = question_id));

-- =========================================================
-- 4. responses / answers: 응답과 답변
-- =========================================================
create table public.responses (
  id bigint generated always as identity primary key,
  survey_id bigint not null references public.surveys (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  submitted_at timestamptz not null default now(),
  status text not null default 'confirmed' check (status in ('confirmed', 'rejected')),
  quality_score integer,
  -- 같은 설문은 한 사람이 한 번만
  unique (survey_id, user_id)
);

create table public.answers (
  id bigint generated always as identity primary key,
  response_id bigint not null references public.responses (id) on delete cascade,
  question_id bigint not null references public.questions (id) on delete cascade,
  option_ids bigint[],
  scale_value integer,
  text_value text,
  unique (response_id, question_id)
);

alter table public.responses enable row level security;
alter table public.answers enable row level security;

create policy "본인 응답만 읽을 수 있다"
  on public.responses for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "본인 응답의 답변만 읽을 수 있다"
  on public.answers for select
  to authenticated
  using (
    exists (
      select 1 from public.responses r
       where r.id = response_id and r.user_id = (select auth.uid())
    )
  );

-- =========================================================
-- 5. 권한: 앱은 읽기만. 쓰기는 서버 함수로만
-- =========================================================
revoke all on public.survey_categories, public.surveys, public.questions,
              public.question_options, public.responses, public.answers
  from anon, authenticated;

grant select on public.survey_categories, public.surveys, public.questions,
                public.question_options, public.responses, public.answers
  to authenticated;

-- =========================================================
-- 6. calc_survey_reward: 응답 1건 보상 (point_rules에서 읽는다)
-- =========================================================
create function public.calc_survey_reward(p_question_count integer, p_est_minutes integer)
returns integer
language plpgsql
stable
set search_path = ''
as $$
declare
  v_key text;
  v_value integer;
begin
  if p_question_count = 1 then
    v_key := 'reward_1q';
  elsif p_est_minutes < 5 then
    v_key := 'reward_lt5';
  elsif p_est_minutes < 15 then
    v_key := 'reward_5to15';
  else
    v_key := 'reward_gte15';
  end if;

  select value::integer into v_value from public.point_rules where key = v_key;
  if v_value is null then
    raise exception 'rule_missing';
  end if;
  return v_value;
end;
$$;

revoke execute on function public.calc_survey_reward(integer, integer) from public, anon;
grant execute on function public.calc_survey_reward(integer, integer) to authenticated;

-- =========================================================
-- 7. submit_response: 응답 제출 + 보상 지급 (한 번에, 하나라도 실패하면 전부 취소)
-- p_answers 예: [{"question_id": 1, "option_id": 3}, {"question_id": 2, "option_id": 7}]
-- 돌려주는 값: 받은 포인트
-- =========================================================
create function public.submit_response(p_survey_id bigint, p_answers jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_account_type text;
  v_my_university bigint;
  v_survey public.surveys%rowtype;
  v_total integer;
  v_valid integer;
  v_response_id bigint;
begin
  -- 1. 로그인한 학생만 응답할 수 있다 (단체 계정은 응답 불가)
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select account_type, university_id
    into v_account_type, v_my_university
    from public.profiles
   where id = v_uid;

  if v_account_type is distinct from 'student' then
    raise exception 'not_student';
  end if;

  -- 2. 설문 확인. 행을 잠가서 동시에 여러 명이 제출해도 목표 인원을 넘지 않게 한다
  select * into v_survey from public.surveys where id = p_survey_id for update;
  if not found then
    raise exception 'survey_not_found';
  end if;

  if v_survey.owner_id = v_uid then
    raise exception 'own_survey';
  end if;

  if v_survey.status <> 'open'
     or (v_survey.closes_at is not null and v_survey.closes_at <= now()) then
    raise exception 'survey_closed';
  end if;

  if v_survey.response_count >= v_survey.target_responses then
    raise exception 'survey_full';
  end if;

  if v_survey.audience = 'campus'
     and v_survey.university_id is distinct from v_my_university then
    raise exception 'not_target';
  end if;

  -- 3. 같은 설문은 한 번만
  if exists (
    select 1 from public.responses where survey_id = p_survey_id and user_id = v_uid
  ) then
    raise exception 'already_responded';
  end if;

  -- 4. 답 검사: 모든 문항에 하나씩, 선택지는 그 문항의 것이어야 한다
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'invalid_answers';
  end if;

  select count(*) into v_total from public.questions where survey_id = p_survey_id;

  select count(distinct q.id)
    into v_valid
    from jsonb_array_elements(p_answers) a
    join public.questions q
      on q.id = (a ->> 'question_id')::bigint
     and q.survey_id = p_survey_id
    join public.question_options o
      on o.id = (a ->> 'option_id')::bigint
     and o.question_id = q.id;

  if v_total = 0 or v_valid <> v_total or jsonb_array_length(p_answers) <> v_total then
    raise exception 'invalid_answers';
  end if;

  -- 5. 응답·답변 저장
  insert into public.responses (survey_id, user_id)
  values (p_survey_id, v_uid)
  returning id into v_response_id;

  insert into public.answers (response_id, question_id, option_ids)
  select v_response_id,
         (a ->> 'question_id')::bigint,
         array[(a ->> 'option_id')::bigint]
    from jsonb_array_elements(p_answers) a;

  -- 6. 보상 지급 (금액은 설문에 저장된 서버 계산값, 고유 제약으로 설문당 1번만)
  insert into public.point_ledger (user_id, amount, status, reason, ref_id)
  values (v_uid, v_survey.reward_points, 'confirmed', 'survey_reward', p_survey_id::text)
  on conflict do nothing;

  -- 7. 응답 수 +1, 목표에 도달하면 자동 마감
  update public.surveys
     set response_count = response_count + 1,
         status = case when response_count + 1 >= target_responses then 'closed' else status end
   where id = p_survey_id;

  return v_survey.reward_points;
end;
$$;

revoke execute on function public.submit_response(bigint, jsonb) from public, anon;
grant execute on function public.submit_response(bigint, jsonb) to authenticated;
