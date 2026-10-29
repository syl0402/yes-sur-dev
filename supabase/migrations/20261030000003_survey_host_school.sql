-- 설문 작성자 표시에 학교 이름 붙이기 (2026-10-30)
--
-- 단체 이름은 같은 학교 안에서만 고유라서, 다른 학교에도 "경영학과 학생회"가 있을 수 있다.
-- 교내 단체는 "중앙대학교 경영학과 학생회"처럼 학교 이름을 앞에 붙인다.
-- - 외부 단체: 이름 그대로
-- - 단체 이름에 이미 학교 이름이 들어 있으면 붙이지 않는다
-- - 학생 설문: 비움 (화면에는 "개인")
--
-- 작성자 이름은 설문이 저장될 때 이 트리거가 채운다 (create_survey가 넣은 값은 덮어쓴다).
-- 앞으로 작성자 표시 규칙을 바꿀 때는 survey_host_name()만 고친다.

-- =========================================================
-- 1. 작성자 표시 이름 만들기 (단체가 아니거나 승인 전이면 null)
-- =========================================================
create function public.survey_host_name(p_owner uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when o.kind = 'campus' and u.name is not null and position(u.name in o.name) = 0
             then u.name || ' ' || o.name
           else o.name
         end
    from public.organizations o
    join public.profiles p on p.id = o.id
    left join public.universities u on u.id = o.university_id
   where o.id = p_owner
     and p.account_type = 'org'
     and p.approval_status = 'approved';
$$;

-- 앱에서 직접 부를 일은 없다 (트리거 안에서만 사용)
revoke execute on function public.survey_host_name(uuid) from public, anon, authenticated;

-- =========================================================
-- 2. 설문 저장 때 작성자 이름 자동 채우기
-- =========================================================
create function public.set_survey_host()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.host_name := public.survey_host_name(new.owner_id);
  new.host_verified := new.host_name is not null;
  return new;
end;
$$;

revoke execute on function public.set_survey_host() from public, anon, authenticated;

create trigger surveys_set_host
  before insert on public.surveys
  for each row execute function public.set_survey_host();

-- =========================================================
-- 3. 이미 있는 설문도 새 규칙으로 다시 채우기
-- =========================================================
update public.surveys
   set host_name = public.survey_host_name(owner_id),
       host_verified = public.survey_host_name(owner_id) is not null;
