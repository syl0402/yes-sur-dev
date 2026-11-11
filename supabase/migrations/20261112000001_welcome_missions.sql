-- 웰컴 14일 미션 (2026-11-12)
--
-- 학생이 미션 화면을 처음 연 날이 1일차. 하루에 하나씩 열리고, 열린 미션은 늦게 해도 된다.
-- 완료 판정은 서버가 이미 있는 활동 기록(설문 응답·투표·댓글 등)으로 한다. 앱은 "보상 받기"만 요청.
-- 미션 1번 = 포인트 1번: mission_claims (사람, 미션) 고유 + point_ledger (사람, 이유, 대상) 고유
-- 1주(1~7일차) 완주 · 14일 완주 보너스는 마지막 미션을 받을 때 함께 지급
--
-- 1. missions          미션 목록 (문구·순서·조건·횟수·보상 등급을 표에서 바꿀 수 있다)
-- 2. mission_progress  사람별 시작일 · OX 퀴즈 통과
-- 3. mission_claims    받은 미션·보너스
-- 4. profile_extras    "나에 대해 알려 주세요" (관심 카테고리 + 거주·통학·아르바이트·학적, 모두 선택). 본인만 읽기
-- 5. 함수: start_missions · get_my_missions · claim_mission · submit_mission_quiz · save_profile_extras

-- =========================================================
-- 0. 포인트 기록 이유 + 보상 금액
-- =========================================================
alter table public.point_ledger drop constraint point_ledger_reason_check;
alter table public.point_ledger add constraint point_ledger_reason_check
  check (reason in ('welcome', 'survey_reward', 'survey_create', 'survey_refund', 'survey_delete',
                    'data_view', 'data_share', 'balance_vote', 'daily_question', 'streak_bonus',
                    'community', 'creator_bonus', 'invite', 'mission', 'mission_bonus'));

insert into public.point_rules (key, value, description) values
  ('mission_s', 10, '웰컴 미션 보상 (쉬움)'),
  ('mission_m', 20, '웰컴 미션 보상 (보통)'),
  ('mission_l', 30, '웰컴 미션 보상 (큼)'),
  ('mission_bonus_week', 50, '웰컴 미션 1~7일차 모두 완료 보너스'),
  ('mission_bonus_all', 100, '웰컴 미션 14개 모두 완료 보너스');

-- =========================================================
-- 1. 미션 목록
-- =========================================================
create table public.missions (
  code text primary key,
  day smallint not null unique check (day between 1 and 30),
  title text not null,
  description text not null,
  -- 완료 조건 종류 (mission_count 함수에서 센다)
  condition text not null check (condition in (
    'quiz', 'about_me', 'daily_answer', 'survey_response', 'post_vote', 'data_view',
    'bookmark', 'worldcup', 'post', 'comment', 'survey_create', 'feedback')),
  -- 몇 번 이상이면 완료 (누적)
  target smallint not null default 1 check (target >= 1),
  reward_key text not null references public.point_rules (key),
  -- 앱에서 "하러 가기"를 누르면 갈 화면
  href text not null,
  -- OX 퀴즈 정답 등 (예: {"answers": [false, true, ...]})
  meta jsonb not null default '{}'::jsonb,
  active boolean not null default true
);

alter table public.missions enable row level security;
create policy "로그인하면 미션 목록을 읽을 수 있다"
  on public.missions for select to authenticated using (true);
revoke all on public.missions from anon, authenticated;
-- 퀴즈 정답(meta)은 앱에 보내지 않으려고 meta를 뺀 칸만 읽게 한다
grant select (code, day, title, description, condition, target, reward_key, href, active) on public.missions to authenticated;

insert into public.missions (code, day, title, description, condition, target, reward_key, href, meta) values
  ('quiz',            1, 'OX 퀴즈로 옛썰 알아보기', '설문에 참여하는 방법과 꼭 지켜야 할 것을 알아봐요', 'quiz', 1, 'mission_l', '/missions/quiz',
     '{"answers": [false, true, true, false, true]}'),
  ('daily_1',         2, '오늘의 질문 답하기', '매일 바뀌는 질문에 답하고 다른 사람들의 생각을 봐요', 'daily_answer', 1, 'mission_s', '/community/daily', '{}'),
  ('survey_1',        3, '설문 1개 응답하기', '관심 가는 설문에 응답하고 포인트를 받아요', 'survey_response', 1, 'mission_m', '/surveys', '{}'),
  ('about_me',        4, '나에 대해 알려 주세요', '관심사를 알려 주면 맞는 설문을 먼저 보여 드려요', 'about_me', 1, 'mission_l', '/missions/about-me', '{}'),
  ('vote_1',          5, '커뮤니티 투표 참여하기', '밸런스 게임이나 골라 줘에 한 표를 던져요', 'post_vote', 1, 'mission_s', '/community', '{}'),
  ('data_view_1',     6, '데이터 탭에서 결과 1개 보기', '다른 대학생들의 설문 결과를 구경해요', 'data_view', 1, 'mission_m', '/data', '{}'),
  ('survey_2',        7, '설문 2개 응답하기', '지금까지 응답한 설문을 모두 세요', 'survey_response', 2, 'mission_m', '/surveys', '{}'),
  ('worldcup_1',      8, '월드컵 참여하기', '이상형 월드컵처럼 끝까지 골라 봐요', 'worldcup', 1, 'mission_s', '/community', '{}'),
  ('post_1',          9, '커뮤니티 글 쓰기', '궁금한 걸 투표로 물어봐요', 'post', 1, 'mission_m', '/community/new', '{}'),
  ('comment_1',      10, '댓글 남기기', '마음에 드는 글이나 오늘의 질문에 댓글을 달아요', 'comment', 1, 'mission_s', '/community', '{}'),
  ('survey_create_1',11, '내 설문 올려 보기', '궁금한 걸 대학생들에게 직접 물어봐요 (보상이 등록비보다 커요)', 'survey_create', 1, 'mission_l', '/create', '{}'),
  ('survey_3',       12, '설문 3개 응답하기', '지금까지 응답한 설문을 모두 세요', 'survey_response', 3, 'mission_l', '/surveys', '{}'),
  ('daily_3',        13, '오늘의 질문 3번 답하기', '연속이 아니어도 괜찮아요. 지금까지 답한 횟수를 세요', 'daily_answer', 3, 'mission_m', '/community/daily', '{}'),
  ('feedback_1',     14, '의견 보내기', '불편한 점이나 바라는 점을 알려 주세요', 'feedback', 1, 'mission_m', '/feedback', '{}');

-- =========================================================
-- 2. 사람별 진행
-- =========================================================
create table public.mission_progress (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- 1일차 (한국 날짜)
  started_on date not null,
  quiz_passed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.mission_progress enable row level security;
create policy "본인 미션 진행만 읽을 수 있다"
  on public.mission_progress for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.mission_progress from anon, authenticated;
grant select on public.mission_progress to authenticated;

-- =========================================================
-- 3. 받은 미션 · 보너스 (code: 미션 code 또는 'bonus_week' · 'bonus_all')
-- =========================================================
create table public.mission_claims (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  code text not null,
  amount integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, code)
);

alter table public.mission_claims enable row level security;
create policy "본인 미션 기록만 읽을 수 있다"
  on public.mission_claims for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.mission_claims from anon, authenticated;
grant select on public.mission_claims to authenticated;

-- =========================================================
-- 4. 나에 대해 (관심사 + 생활 정보, 모두 선택. 결과·CSV에 넣지 않는다)
-- =========================================================
create table public.profile_extras (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- 관심 설문 카테고리 key (survey_categories.key)
  interests text[] not null default '{}',
  housing text check (housing in ('family', 'alone', 'dorm', 'other')),
  commute text check (commute in ('lt30', '30to60', '60to90', 'gte90')),
  part_time text check (part_time in ('yes', 'no')),
  -- 학적 상태: 재학 · 휴학 · 졸업 예정 · 졸업 (휴학생·졸업 예정자·졸업생 대상 설문 추천)
  enrollment text check (enrollment in ('enrolled', 'leave', 'graduating', 'graduated')),
  updated_at timestamptz not null default now()
);

alter table public.profile_extras enable row level security;
create policy "본인 정보만 읽을 수 있다"
  on public.profile_extras for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.profile_extras from anon, authenticated;
grant select on public.profile_extras to authenticated;

-- =========================================================
-- 5. 함수
-- =========================================================

-- 조건별 지금까지 횟수 (서버 안에서만 쓴다)
create function public.mission_count(p_uid uuid, p_condition text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case p_condition
    when 'quiz' then (select count(*) from public.mission_progress where user_id = p_uid and quiz_passed_at is not null)
    when 'about_me' then (select count(*) from public.profile_extras where user_id = p_uid and cardinality(interests) > 0)
    when 'daily_answer' then (select count(*) from public.daily_answers where user_id = p_uid)
    when 'survey_response' then (select count(*) from public.responses where user_id = p_uid and status = 'confirmed')
    when 'post_vote' then (select count(*) from public.post_votes where user_id = p_uid)
    when 'data_view' then (select count(*) from public.survey_views where user_id = p_uid)
    when 'bookmark' then (select count(*) from public.hub_bookmarks where user_id = p_uid)
    when 'worldcup' then (select count(*) from public.worldcup_plays where user_id = p_uid)
    when 'post' then (select count(*) from public.posts where author_id = p_uid and moderation <> 'removed')
    when 'comment' then (select count(*) from public.comments where author_id = p_uid and moderation not in ('removed', 'deleted'))
    when 'survey_create' then (select count(*) from public.surveys where owner_id = p_uid)
    when 'feedback' then (select count(*) from public.feedback where user_id = p_uid)
    else 0
  end::integer;
$$;
revoke execute on function public.mission_count(uuid, text) from public, anon, authenticated;

-- 미션 시작 (이미 시작했으면 그대로). 학생만. 1일차 날짜를 돌려준다
create function public.start_missions()
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_on date;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and account_type = 'student') then
    raise exception 'students_only';
  end if;
  insert into public.mission_progress (user_id, started_on)
  values (v_uid, (now() at time zone 'Asia/Seoul')::date)
  on conflict (user_id) do nothing;
  select started_on into v_on from public.mission_progress where user_id = v_uid;
  return v_on;
end;
$$;

-- 내 미션 화면. 시작 전이면 started_on = null
-- status: locked(아직 안 열림) · open(열림, 조건 미달) · ready(보상 받기 가능) · done(받음)
create function public.get_my_missions()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_on date;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_day integer;
  v_missions jsonb;
  v_bonuses jsonb;
  v_earned integer;
  v_total integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select started_on into v_on from public.mission_progress where user_id = v_uid;
  -- 오늘이 몇 일차인지 (시작 전이면 1일차로 보여 준다)
  v_day := case when v_on is null then 1 else (v_today - v_on) + 1 end;

  select coalesce(jsonb_agg(jsonb_build_object(
           'code', m.code, 'day', m.day, 'title', m.title, 'description', m.description,
           'href', m.href, 'target', m.target,
           'progress', least(public.mission_count(v_uid, m.condition), m.target),
           'reward', public.point_rule(m.reward_key)::integer,
           'unlock_in', greatest(m.day - v_day, 0),
           'status', case
             when c.code is not null then 'done'
             when m.day > v_day then 'locked'
             when public.mission_count(v_uid, m.condition) >= m.target then 'ready'
             else 'open' end
         ) order by m.day), '[]'::jsonb)
    into v_missions
    from public.missions m
    left join public.mission_claims c on c.user_id = v_uid and c.code = m.code
   where m.active;

  select jsonb_build_array(
           jsonb_build_object('code', 'bonus_week', 'reward', public.point_rule('mission_bonus_week')::integer,
             'done', exists (select 1 from public.mission_claims where user_id = v_uid and code = 'bonus_week')),
           jsonb_build_object('code', 'bonus_all', 'reward', public.point_rule('mission_bonus_all')::integer,
             'done', exists (select 1 from public.mission_claims where user_id = v_uid and code = 'bonus_all')))
    into v_bonuses;

  select coalesce(sum(amount), 0)::integer into v_earned from public.mission_claims where user_id = v_uid;
  select coalesce(sum(public.point_rule(reward_key)), 0)::integer
           + public.point_rule('mission_bonus_week')::integer + public.point_rule('mission_bonus_all')::integer
    into v_total
    from public.missions where active;

  return jsonb_build_object('started_on', v_on, 'today_day', v_day, 'earned', v_earned, 'total', v_total,
                            'missions', v_missions, 'bonuses', v_bonuses);
end;
$$;

-- 보상 받기. 서버가 열렸는지·조건을 채웠는지 확인하고 미션 포인트 + (해당되면) 보너스를 한 번에 지급
-- 돌려주는 값: { reward, bonuses: [{code, amount}] }
create function public.claim_mission(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_on date;
  v_day integer;
  v_m public.missions%rowtype;
  v_reward integer;
  v_bonus integer;
  v_bonuses jsonb := '[]'::jsonb;
  v_week_count integer;
  v_week_total integer;
  v_all_count integer;
  v_all_total integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  -- 진행 행을 잠근다: 버튼을 연타해도 하나씩 처리
  select started_on into v_on from public.mission_progress where user_id = v_uid for update;
  if not found then
    raise exception 'mission_not_started';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and account_type = 'student') then
    raise exception 'students_only';
  end if;

  select * into v_m from public.missions where code = p_code and active;
  if not found then
    raise exception 'mission_not_found';
  end if;
  v_day := ((now() at time zone 'Asia/Seoul')::date - v_on) + 1;
  if v_m.day > v_day then
    raise exception 'mission_locked';
  end if;
  if exists (select 1 from public.mission_claims where user_id = v_uid and code = p_code) then
    raise exception 'mission_already_claimed';
  end if;
  if public.mission_count(v_uid, v_m.condition) < v_m.target then
    raise exception 'mission_not_done';
  end if;

  v_reward := public.point_rule(v_m.reward_key)::integer;
  insert into public.mission_claims (user_id, code, amount) values (v_uid, p_code, v_reward);
  if v_reward > 0 then
    insert into public.point_ledger (user_id, amount, status, reason, ref_id)
    values (v_uid, v_reward, 'confirmed', 'mission', p_code);
  end if;

  -- 1주 완주: 1~7일차 미션을 모두 받았으면
  select count(*) into v_week_total from public.missions where active and day <= 7;
  select count(*) into v_week_count from public.missions m
    join public.mission_claims c on c.user_id = v_uid and c.code = m.code
   where m.active and m.day <= 7;
  if v_week_total > 0 and v_week_count = v_week_total
     and not exists (select 1 from public.mission_claims where user_id = v_uid and code = 'bonus_week') then
    v_bonus := public.point_rule('mission_bonus_week')::integer;
    insert into public.mission_claims (user_id, code, amount) values (v_uid, 'bonus_week', v_bonus);
    if v_bonus > 0 then
      insert into public.point_ledger (user_id, amount, status, reason, ref_id)
      values (v_uid, v_bonus, 'confirmed', 'mission_bonus', 'bonus_week');
    end if;
    v_bonuses := v_bonuses || jsonb_build_object('code', 'bonus_week', 'amount', v_bonus);
  end if;

  -- 14일 완주: 모든 미션을 받았으면
  select count(*) into v_all_total from public.missions where active;
  select count(*) into v_all_count from public.missions m
    join public.mission_claims c on c.user_id = v_uid and c.code = m.code
   where m.active;
  if v_all_total > 0 and v_all_count = v_all_total
     and not exists (select 1 from public.mission_claims where user_id = v_uid and code = 'bonus_all') then
    v_bonus := public.point_rule('mission_bonus_all')::integer;
    insert into public.mission_claims (user_id, code, amount) values (v_uid, 'bonus_all', v_bonus);
    if v_bonus > 0 then
      insert into public.point_ledger (user_id, amount, status, reason, ref_id)
      values (v_uid, v_bonus, 'confirmed', 'mission_bonus', 'bonus_all');
    end if;
    v_bonuses := v_bonuses || jsonb_build_object('code', 'bonus_all', 'amount', v_bonus);
  end if;

  return jsonb_build_object('reward', v_reward, 'bonuses', v_bonuses);
end;
$$;

-- OX 퀴즈 채점. 다 맞히면 통과 기록 (포인트는 claim_mission에서). 틀린 문제 번호(0부터)를 돌려준다
create function public.submit_mission_quiz(p_answers boolean[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_key boolean[];
  v_wrong integer[] := '{}';
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.mission_progress where user_id = v_uid) then
    raise exception 'mission_not_started';
  end if;
  select array(select (x)::boolean from jsonb_array_elements_text(meta -> 'answers') as x)
    into v_key from public.missions where code = 'quiz';
  if v_key is null or p_answers is null or cardinality(p_answers) <> cardinality(v_key) then
    raise exception 'invalid_quiz_answers';
  end if;
  for i in 1 .. cardinality(v_key) loop
    if p_answers[i] is distinct from v_key[i] then
      v_wrong := v_wrong || (i - 1);
    end if;
  end loop;
  if cardinality(v_wrong) = 0 then
    update public.mission_progress set quiz_passed_at = coalesce(quiz_passed_at, now()) where user_id = v_uid;
  end if;
  return jsonb_build_object('passed', cardinality(v_wrong) = 0, 'wrong', to_jsonb(v_wrong));
end;
$$;

-- 나에 대해 저장 (관심사 1개 이상 필수, 생활 정보는 null = 응답 안 함)
create function public.save_profile_extras(
  p_interests text[], p_housing text, p_commute text, p_part_time text, p_enrollment text)
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
  if p_interests is null or cardinality(p_interests) = 0 or cardinality(p_interests) > 8
     or exists (select 1 from unnest(p_interests) k where k not in (select key from public.survey_categories)) then
    raise exception 'invalid_interests';
  end if;
  insert into public.profile_extras (user_id, interests, housing, commute, part_time, enrollment, updated_at)
  values (v_uid, p_interests, p_housing, p_commute, p_part_time, p_enrollment, now())
  on conflict (user_id) do update
    set interests = excluded.interests, housing = excluded.housing, commute = excluded.commute,
        part_time = excluded.part_time, enrollment = excluded.enrollment, updated_at = now();
end;
$$;

revoke execute on function public.start_missions() from public, anon;
revoke execute on function public.get_my_missions() from public, anon;
revoke execute on function public.claim_mission(text) from public, anon;
revoke execute on function public.submit_mission_quiz(boolean[]) from public, anon;
revoke execute on function public.save_profile_extras(text[], text, text, text, text) from public, anon;
grant execute on function public.start_missions() to authenticated;
grant execute on function public.get_my_missions() to authenticated;
grant execute on function public.claim_mission(text) to authenticated;
grant execute on function public.submit_mission_quiz(boolean[]) to authenticated;
grant execute on function public.save_profile_extras(text[], text, text, text, text) to authenticated;

-- 확인
select day, code, title, condition, target, reward_key from public.missions order by day;
