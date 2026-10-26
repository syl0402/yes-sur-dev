-- 가입 여부 확인 함수 (회원가입·비밀번호 찾기의 이메일 입력 단계에서 사용)
-- 2026-10-27 결정: 이미 가입된 메일 / 가입되지 않은 메일을 이메일 입력 단계에서 바로 알려준다
-- 예/아니오만 돌려주고, 이메일 목록이나 회원정보는 돌려주지 않는다
-- 적용: Supabase 대시보드 → SQL Editor에 전체를 붙여넣고 Run

create function public.is_email_registered(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- 가입을 마친 계정(profiles가 있는 계정)만 "가입됨"으로 본다.
  -- 인증만 하고 가입을 마치지 않은 계정은 다시 가입해서 이어갈 수 있게 "아님"으로 본다
  select exists (
    select 1
      from auth.users u
      join public.profiles p on p.id = u.id
     where lower(u.email) = lower(btrim(p_email))
  );
$$;

revoke execute on function public.is_email_registered(text) from public;
grant execute on function public.is_email_registered(text) to anon, authenticated;
