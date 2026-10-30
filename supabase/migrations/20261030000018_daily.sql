-- 오늘의 질문 + 출석 (2026-10-30)
--
-- 운영자가 날짜별로 미리 예약한 A/B 질문에 하루 한 번 답하면 출석 포인트, 연속 n일마다 보너스.
-- A·B 비율은 답한 뒤에만 보여 준다 (남의 선택을 보고 따라가지 않게).
-- 날짜는 한국 시간 기준. 연속 일수는 "질문이 올라온 날" 기준으로 센다 (예약을 빠뜨린 날은 끊기지 않음).
-- 단체 계정은 답할 수 있지만 포인트는 없다 (포인트를 쓰지 않음).
-- 질문 예약: supabase/seed/daily_questions.sql 또는 Table Editor → daily_questions

-- =========================================================
-- 1. 설정값 · 포인트 기록 이유
-- =========================================================
insert into public.point_rules (key, value, description) values
  ('daily_reward', 5,  '오늘의 질문에 답하면 주는 출석 포인트'),
  ('streak_days',  7,  '연속 출석 보너스를 주는 주기 (일)'),
  ('streak_bonus', 30, '연속 출석 보너스 포인트');

alter table public.point_ledger drop constraint point_ledger_reason_check;
alter table public.point_ledger add constraint point_ledger_reason_check
  check (reason in ('welcome', 'survey_reward', 'survey_create', 'survey_refund',
                    'data_view', 'data_share', 'balance_vote', 'daily_question', 'streak_bonus'));

-- =========================================================
-- 2. 표
-- =========================================================
create table public.daily_questions (
  id bigint generated always as identity primary key,
  -- 하루에 질문 하나 (한국 날짜)
  day date not null unique,
  question text not null check (char_length(question) between 1 and 100),
  option_a text not null check (char_length(option_a) between 1 and 30),
  option_b text not null check (char_length(option_b) between 1 and 30),
  created_at timestamptz not null default now()
);

alter table public.daily_questions enable row level security;

-- 오늘까지 질문만 보인다 (내일 질문 미리보기 방지)
create policy "오늘까지의 질문을 읽을 수 있다"
  on public.daily_questions for select
  to authenticated
  using (day <= (now() at time zone 'Asia/Seoul')::date);

revoke all on public.daily_questions from anon, authenticated;
grant select on public.daily_questions to authenticated;

create table public.daily_answers (
  id bigint generated always as identity primary key,
  question_id bigint not null references public.daily_questions (id) on delete cascade,
  -- 탈퇴하면 사람 연결만 끊고 답은 비율에 남긴다
  user_id uuid references public.profiles (id) on delete set null,
  choice text not null check (choice in ('a', 'b')),
  created_at timestamptz not null default now(),
  -- 한 사람이 한 질문에 한 번만 (연타해도 포인트 한 번)
  unique (question_id, user_id)
);

alter table public.daily_answers enable row level security;

create policy "본인 답만 읽을 수 있다"
  on public.daily_answers for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.daily_answers from anon, authenticated;
grant select on public.daily_answers to authenticated;

-- =========================================================
-- 3. 연속 일수: p_end까지 올라온 질문을 최근부터 세어, 처음 빠뜨린 질문 전까지
-- =========================================================
create function public.daily_streak(p_uid uuid, p_end date)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
    from (
      select sum(case when a.id is null then 1 else 0 end)
               over (order by q.day desc rows unbounded preceding) as misses
        from public.daily_questions q
        left join public.daily_answers a on a.question_id = q.id and a.user_id = p_uid
       where q.day <= p_end
    ) t
   where t.misses = 0;
$$;

revoke execute on function public.daily_streak(uuid, date) from public, anon, authenticated;

-- =========================================================
-- 4. get_today_daily: 오늘의 질문 (없으면 null)
-- { id, question, option_a, option_b, my_choice, a, b (답한 뒤에만), streak, reward, streak_days, streak_bonus, rewarded }
-- =========================================================
create function public.get_today_daily()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_q public.daily_questions%rowtype;
  v_choice text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_q from public.daily_questions where day = v_today;
  if not found then
    return null;
  end if;
  select choice into v_choice from public.daily_answers where question_id = v_q.id and user_id = v_uid;

  return jsonb_build_object(
    'id', v_q.id,
    'question', v_q.question,
    'option_a', v_q.option_a,
    'option_b', v_q.option_b,
    'my_choice', v_choice,
    'a', case when v_choice is not null then
           (select count(*) from public.daily_answers where question_id = v_q.id and choice = 'a') end,
    'b', case when v_choice is not null then
           (select count(*) from public.daily_answers where question_id = v_q.id and choice = 'b') end,
    -- 오늘 답했으면 오늘까지, 아직이면 어제까지의 연속
    'streak', public.daily_streak(v_uid, case when v_choice is not null then v_today else v_today - 1 end),
    'reward', public.point_rule('daily_reward'),
    'streak_days', public.point_rule('streak_days'),
    'streak_bonus', public.point_rule('streak_bonus'),
    -- 포인트를 받는 계정인가 (단체는 포인트를 쓰지 않음)
    'rewarded', exists (select 1 from public.profiles where id = v_uid and account_type = 'student')
  );
end;
$$;

-- =========================================================
-- 5. answer_daily: 오늘의 질문에 답하기 → 출석 포인트 (+ 연속 보너스)
-- { reward, bonus, streak }
-- =========================================================
create function public.answer_daily(p_choice text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_q public.daily_questions%rowtype;
  v_student boolean;
  v_reward integer := 0;
  v_bonus integer := 0;
  v_streak integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_choice is null or p_choice not in ('a', 'b') then
    raise exception 'invalid_choice';
  end if;
  -- 회원정보 행을 잠근다: 동시에 눌러도 하나씩 처리
  select account_type = 'student' into v_student from public.profiles where id = v_uid for update;

  select * into v_q from public.daily_questions where day = v_today;
  if not found then
    raise exception 'no_daily';
  end if;

  begin
    insert into public.daily_answers (question_id, user_id, choice) values (v_q.id, v_uid, p_choice);
  exception when unique_violation then
    raise exception 'already_answered';
  end;

  v_streak := public.daily_streak(v_uid, v_today);

  if v_student then
    v_reward := public.point_rule('daily_reward')::integer;
    if v_reward > 0 then
      insert into public.point_ledger (user_id, amount, status, reason, ref_id)
      values (v_uid, v_reward, 'confirmed', 'daily_question', v_q.id::text);
    end if;
    if v_streak > 0 and v_streak % public.point_rule('streak_days')::integer = 0 then
      v_bonus := public.point_rule('streak_bonus')::integer;
      if v_bonus > 0 then
        insert into public.point_ledger (user_id, amount, status, reason, ref_id)
        values (v_uid, v_bonus, 'confirmed', 'streak_bonus', v_q.id::text);
      end if;
    end if;
  end if;

  return jsonb_build_object('reward', v_reward, 'bonus', v_bonus, 'streak', v_streak);
end;
$$;

revoke execute on function public.get_today_daily() from public, anon;
revoke execute on function public.answer_daily(text) from public, anon;
grant execute on function public.get_today_daily() to authenticated;
grant execute on function public.answer_daily(text) to authenticated;
