-- 웰컴 미션 푸시 알림 (2026-11-12)
--
-- 매일 저녁 7시(한국)에 "오늘 미션을 아직 안 받은 + 미션 알림을 켠" 학생에게 한 번 보낸다.
-- 오늘의 질문 알림(낮 12시, send_daily_push)과 따로 켜고 끈다. 같은 날·같은 종류는 한 번만 (notifications 고유).
--
-- 1. profiles.notify_mission   미션 알림 켜기/끄기 (기본 켬. 실제로 받으려면 기기 허락도 필요)
-- 2. notifications.kind        'mission' 추가
-- 3. set_notify_mission(on)    앱의 켜기/끄기
-- 4. send_mission_push()       pg_cron이 매일 실행 → Expo 푸시 서버로 100개씩

alter table public.profiles add column notify_mission boolean not null default true;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('daily', 'mission'));

create function public.set_notify_mission(p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  update public.profiles set notify_mission = p_on where id = auth.uid();
end;
$$;

revoke execute on function public.set_notify_mission(boolean) from public, anon;
grant execute on function public.set_notify_mission(boolean) to authenticated;

-- 돌려주는 값: 이번에 보낸 알림 수 (기기 기준). cron만 실행 (앱에서는 부를 수 없음)
create function public.send_mission_push()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_msgs jsonb;
  v_batch jsonb;
  v_sent integer := 0;
  v_size constant integer := 100;
begin
  -- 오늘 열린 미션(일차 = 오늘 - 시작일 + 1)을 아직 안 받은 학생. 기록을 먼저 남기고 새로 남긴 사람에게만 보낸다
  with targets as (
    select mp.user_id, m.day, m.title, public.point_rule(m.reward_key)::integer as reward
      from public.mission_progress mp
      join public.profiles p on p.id = mp.user_id and p.account_type = 'student' and p.notify_mission
      join public.missions m on m.active and m.day = (v_day - mp.started_on) + 1
     where exists (select 1 from public.push_tokens t where t.user_id = mp.user_id)
       and not exists (select 1 from public.mission_claims c where c.user_id = mp.user_id and c.code = m.code)
  ),
  logged as (
    insert into public.notifications (user_id, kind, day, title, body, url)
    select user_id, 'mission', v_day, '웰컴 미션 DAY ' || day || '이 열렸어요', title || ' · +' || reward || 'P', '/missions'
      from targets
    on conflict (user_id, kind, day) do nothing
    returning user_id, title, body, url
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'to', t.token,
           'title', l.title,
           'body', l.body,
           'sound', 'default',
           'channelId', 'mission',
           'data', jsonb_build_object('url', l.url)
         )), '[]'::jsonb)
    into v_msgs
    from logged l
    join public.push_tokens t on t.user_id = l.user_id;

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

revoke execute on function public.send_mission_push() from public, anon, authenticated;

-- 매일 저녁 7시(한국) = 10시 UTC. 같은 이름이면 바꿔 쓴다
select cron.schedule(
  'welcome-mission-push',
  '0 10 * * *',
  $$select public.send_mission_push()$$
);

-- 확인: 등록된 작업
select jobid, jobname, schedule, command from cron.job where jobname in ('daily-question-push', 'welcome-mission-push');
