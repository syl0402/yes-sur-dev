-- 2026-11-14 온보딩 시안: 로그인 전 첫 화면·회원 종류 화면에 "가입하면 500P"
-- point_rules는 로그인한 사람만 읽을 수 있어서, 가입 선물 금액 하나만 알려 주는 함수를 연다 (다른 값은 그대로 비공개)

create function public.get_welcome_points()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.point_rule('welcome')::integer;
$$;

revoke execute on function public.get_welcome_points() from public;
grant execute on function public.get_welcome_points() to anon, authenticated;

select public.get_welcome_points() as welcome;
