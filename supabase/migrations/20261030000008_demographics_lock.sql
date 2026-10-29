-- 성별·출생연도는 한 번 정하면 고정 (2026-10-30)
--
-- 아무 때나 바꿀 수 있으면 대상 설문에 맞추려고 정보를 바꾸거나 통계를 믿기 어려워진다.
-- update_my_demographics는 "비어 있는 칸만" 채운다. 둘 다 이미 있으면 거절(demographics_locked).
-- 고쳐야 하면 운영자에게 문의 → 운영자가 대시보드에서 수정한다.

create or replace function public.update_my_demographics(p_gender text, p_birth_year integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found or v_profile.account_type <> 'student' then
    raise exception 'not_student';
  end if;

  if v_profile.gender is not null and v_profile.birth_year is not null then
    raise exception 'demographics_locked';
  end if;

  perform public.check_demographics(p_gender, p_birth_year);

  -- 비어 있는 칸만 채운다 (이미 있는 값은 그대로)
  update public.profiles
     set gender = coalesce(gender, p_gender),
         birth_year = coalesce(birth_year, p_birth_year)
   where id = v_uid;
end;
$$;
