-- 푸시 알림: 오늘의 질문 (2026-11-10)
--
-- 매일 낮 12시(한국)에 "오늘의 질문에 아직 답하지 않은 + 알림을 켠" 사람에게 한 번 보낸다.
-- 안드로이드 앱(1.0.1 이상)만 받는다. 아이폰은 웹으로 써서 받지 못한다.
--
-- 1. push_tokens     기기 알림 주소 (한 사람이 기기 여러 개). 앱은 직접 읽고 쓰지 못하고 함수로만 등록·삭제
-- 2. profiles.notify_daily  오늘의 질문 알림 켜기/끄기 (기본 켬. 실제로 받으려면 기기에서 알림 허락도 해야 함)
-- 3. notifications   보낸 알림 기록 (나중에 알림함). 본인 것만 읽기. 같은 날·같은 종류는 한 번만 (중복 발송 방지)
-- 4. send_daily_push()  pg_cron이 매일 실행 → pg_net으로 Expo 푸시 서버(https://exp.host)에 100개씩 보낸다
--
-- 이 파일이 실패하면: 대시보드 Database → Extensions에서 pg_net · pg_cron을 켠 뒤 다시 실행

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- =========================================================
-- 1. 기기 알림 주소
-- =========================================================
create table public.push_tokens (
  -- Expo 알림 주소 "ExponentPushToken[...]" (기기마다 하나)
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
-- 정책 없음 + 권한 회수 = 앱에서 직접 못 읽고 못 쓴다 (아래 함수로만)
revoke all on public.push_tokens from anon, authenticated;

-- =========================================================
-- 2. 알림 켜기/끄기
-- =========================================================
alter table public.profiles add column notify_daily boolean not null default true;

-- =========================================================
-- 3. 보낸 알림 기록 (알림함)
-- =========================================================
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('daily')),
  -- 한국 날짜 (같은 날·같은 종류는 한 번만)
  day date not null,
  title text not null,
  body text not null,
  -- 누르면 갈 화면 (앱 경로)
  url text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, kind, day)
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "본인 알림만 읽을 수 있다"
  on public.notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

-- =========================================================
-- 4. 앱이 부르는 함수
-- =========================================================

-- 이 기기의 알림 주소를 내 것으로 등록 (같은 기기에 다른 사람이 로그인하면 그 사람 것으로 바뀐다)
create function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[.+\]$' or char_length(p_token) > 200 then
    raise exception 'invalid_push_token';
  end if;
  if p_platform not in ('android', 'ios') then
    raise exception 'invalid_platform';
  end if;

  insert into public.push_tokens (token, user_id, platform)
  values (p_token, auth.uid(), p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

-- 로그아웃할 때 이 기기 알림 주소 지우기 (내 것만)
create function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

-- 오늘의 질문 알림 켜기/끄기
create function public.set_notify_daily(p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  update public.profiles set notify_daily = p_on where id = auth.uid();
end;
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
revoke execute on function public.unregister_push_token(text) from public, anon;
revoke execute on function public.set_notify_daily(boolean) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
grant execute on function public.set_notify_daily(boolean) to authenticated;

-- =========================================================
-- 5. 매일 발송 (cron만 실행. 앱에서는 부를 수 없음)
-- =========================================================
-- 돌려주는 값: 이번에 보낸 알림 수 (기기 기준)
create function public.send_daily_push()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_q public.daily_questions;
  v_msgs jsonb;
  v_batch jsonb;
  v_sent integer := 0;
  v_size constant integer := 100;
begin
  select * into v_q from public.daily_questions where day = v_day;
  if not found then
    return 0;
  end if;

  -- 기록을 먼저 남기고(같은 날 두 번 실행돼도 한 번만), 새로 남긴 사람의 기기에만 보낸다
  with targets as (
    select p.id as user_id
      from public.profiles p
     where p.notify_daily
       and exists (select 1 from public.push_tokens t where t.user_id = p.id)
       and not exists (select 1 from public.daily_answers a where a.question_id = v_q.id and a.user_id = p.id)
  ),
  logged as (
    insert into public.notifications (user_id, kind, day, title, body, url)
    select user_id, 'daily', v_day, '오늘의 질문이 도착했어요', v_q.question, '/community/daily'
      from targets
    on conflict (user_id, kind, day) do nothing
    returning user_id, title, body, url
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'to', t.token,
           'title', l.title,
           'body', l.body,
           'sound', 'default',
           'channelId', 'daily',
           'data', jsonb_build_object('url', l.url)
         )), '[]'::jsonb)
    into v_msgs
    from logged l
    join public.push_tokens t on t.user_id = l.user_id;

  -- Expo 푸시 서버는 한 번에 100개까지
  for i in 0 .. greatest(jsonb_array_length(v_msgs) - 1, 0) / v_size loop
    select jsonb_agg(e) into v_batch
      from jsonb_array_elements(v_msgs) with ordinality as x (e, n)
     where n > i * v_size and n <= (i + 1) * v_size;
    exit when v_batch is null;
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_batch,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
    v_sent := v_sent + jsonb_array_length(v_batch);
  end loop;

  return v_sent;
end;
$$;

revoke execute on function public.send_daily_push() from public, anon, authenticated;

-- 매일 낮 12시(한국) = 03시 UTC. 같은 이름이면 바꿔 쓴다
select cron.schedule(
  'daily-question-push',
  '0 3 * * *',
  $$select public.send_daily_push()$$
);

-- 확인: 등록된 작업
select jobid, jobname, schedule, command from cron.job where jobname = 'daily-question-push';
