-- 데이터 탭 결과 저장(북마크) · F-501 (2026-11-01)
--
-- 관심 있는 결과를 ☆로 저장하고, 데이터 탭 "저장한 결과"에서 모아 본다.
-- 표는 서버 함수로만 읽고 쓴다 (앱 권한 없음). 저장 목록은 본인 것만.
-- 저장할 수 있는 설문: 데이터 탭에서 볼 수 있는 것(survey_listed) 또는 내 설문.

create table public.hub_bookmarks (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  survey_id bigint not null references public.surveys (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- 같은 결과는 한 번만
  unique (user_id, survey_id)
);

alter table public.hub_bookmarks enable row level security;
revoke all on public.hub_bookmarks from anon, authenticated;

-- 저장 ↔ 해제. 돌려줌: 저장된 상태면 true
create function public.toggle_bookmark(p_survey_id bigint)
returns boolean
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

  delete from public.hub_bookmarks where user_id = v_uid and survey_id = p_survey_id;
  if found then
    return false;
  end if;

  if not coalesce(public.survey_listed(p_survey_id, v_uid), false) then
    raise exception 'not_listed';
  end if;
  insert into public.hub_bookmarks (user_id, survey_id) values (v_uid, p_survey_id)
  on conflict (user_id, survey_id) do nothing;
  return true;
end;
$$;

-- 내가 저장한 설문 번호 (최근 저장 순)
create function public.get_my_bookmarks()
returns bigint[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(survey_id order by created_at desc), '{}')
    from public.hub_bookmarks
   where user_id = auth.uid();
$$;

revoke execute on function public.toggle_bookmark(bigint) from public, anon;
revoke execute on function public.get_my_bookmarks() from public, anon;
grant execute on function public.toggle_bookmark(bigint) to authenticated;
grant execute on function public.get_my_bookmarks() to authenticated;
