-- 웰컴 미션 시작일 (2026-11-12)
--
-- 앱 업데이트는 먼저 올려서 화면(UI)을 미리 볼 수 있게 하고, 1일차는 비공개 테스트 시작일(11/14)부터 센다.
-- 시작일 전에 미션 화면을 연 사람도 1일차 = 시작일. 그 뒤에 처음 연 사람은 연 날이 1일차.
-- 시작일 전에는 모든 칸이 잠김(D-n)이라 포인트를 받을 수 없다 (claim_mission의 열림 확인 그대로).
-- 날짜는 point_rules 'mission_launch_date' (YYYYMMDD 숫자)로 바꿀 수 있다.

insert into public.point_rules (key, value, description) values
  ('mission_launch_date', 20261114, '웰컴 미션 시작일 YYYYMMDD (이 날 전에 연 사람도 이 날이 1일차)');

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
  v_on date;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and account_type = 'student') then
    raise exception 'students_only';
  end if;
  insert into public.mission_progress (user_id, started_on)
  values (v_uid, greatest(v_today, v_launch))
  on conflict (user_id) do nothing;
  select started_on into v_on from public.mission_progress where user_id = v_uid;
  return v_on;
end;
$$;

revoke execute on function public.start_missions() from public, anon;
grant execute on function public.start_missions() to authenticated;

-- 이미 시작한 사람(개발 테스트 계정)도 시작일 전에 시작했다면 시작일로 맞춘다
update public.mission_progress
   set started_on = to_date(public.point_rule('mission_launch_date')::bigint::text, 'YYYYMMDD')
 where started_on < to_date(public.point_rule('mission_launch_date')::bigint::text, 'YYYYMMDD');

-- 확인
select value as 시작일 from public.point_rules where key = 'mission_launch_date';
