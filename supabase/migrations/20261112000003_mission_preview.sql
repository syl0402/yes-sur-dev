-- 웰컴 미션 미리보기 (2026-11-12)
--
-- 시작일(mission_launch_date, 11/14) 전에 미션 화면을 처음 연 사람은 1일차 = 오늘 - 미리보기 일수(3)
-- → 팀원들이 SQL 없이 1~4일차를 열어 볼 수 있다. 시작일부터는 원래대로 "처음 연 날 = 1일차".
-- 미리보기 기록은 11/14 아침(테스터 전)에 전체 초기화한다 (docs/PROGRESS.md 체크리스트).
-- 미리보기를 끄려면 mission_preview_days를 0으로.

insert into public.point_rules (key, value, description) values
  ('mission_preview_days', 3, '웰컴 미션 시작일 전에 연 사람에게 미리 열어 줄 일수 (0 = 미리보기 없음, 시작일 이후엔 쓰지 않음)');

create or replace function public.start_missions()
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_launch date := to_date(public.point_rule('mission_launch_date')::bigint::text, 'YYYYMMDD');
  v_preview integer := public.point_rule('mission_preview_days')::integer;
  v_on date;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and account_type = 'student') then
    raise exception 'students_only';
  end if;
  insert into public.mission_progress (user_id, started_on)
  values (v_uid, case when v_today < v_launch and v_preview > 0 then v_today - v_preview else greatest(v_today, v_launch) end)
  on conflict (user_id) do nothing;
  select started_on into v_on from public.mission_progress where user_id = v_uid;
  return v_on;
end;
$$;

revoke execute on function public.start_missions() from public, anon;
grant execute on function public.start_missions() to authenticated;

-- 이미 연 팀원(1일차가 시작일로 잡혀 전부 잠긴 사람)도 시작일 전이면 미리보기로 맞춘다
update public.mission_progress
   set started_on = (now() at time zone 'Asia/Seoul')::date - public.point_rule('mission_preview_days')::integer
 where (now() at time zone 'Asia/Seoul')::date < to_date(public.point_rule('mission_launch_date')::bigint::text, 'YYYYMMDD')
   and started_on > (now() at time zone 'Asia/Seoul')::date - public.point_rule('mission_preview_days')::integer;

-- 확인: 미션을 연 사람 수와 1일차
select started_on, count(*) from public.mission_progress group by started_on order by started_on;
