-- 개인 설문 작성자 표시: 닉네임 공개 / 비공개("옛썰러") 고르기 (2026-11-02)
--
-- 지금까지 개인(학생) 설문은 작성자가 모두 "개인"으로만 보였다 (host_name = null).
-- 학생이 원하면 닉네임을 공개할 수 있게 한다. 기본은 비공개이고, 비공개 이름은 앱에서 "옛썰러"로 보여 준다.
-- 닉네임 공개는 host_name에 닉네임을 넣는 것으로 처리한다. host_verified(인증 단체 ✓)는 false 그대로라
-- 목록·상세·데이터 허브 함수는 이미 host_name을 돌려주므로 고치지 않는다.
-- 닉네임을 바꾸면 공개한 설문의 이름도 같이 바뀐다 (아래 트리거).

alter table public.surveys add column show_nickname boolean not null default false;

-- 내 개인 설문의 닉네임 공개 켜기·끄기 (등록자 학생만, 단체 설문은 대상 아님)
create function public.set_survey_show_nickname(p_survey_id bigint, p_show boolean)
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
  if not exists (select 1 from public.profiles where id = v_uid and account_type = 'student') then
    raise exception 'nickname_student_only';
  end if;

  update public.surveys
     set show_nickname = p_show,
         host_name = case when p_show then (select nickname from public.profiles where id = v_uid) end
   where id = p_survey_id and owner_id = v_uid and not host_verified;
  if not found then
    raise exception 'survey_not_found';
  end if;
end;
$$;

revoke execute on function public.set_survey_show_nickname(bigint, boolean) from public, anon;
grant execute on function public.set_survey_show_nickname(bigint, boolean) to authenticated;

-- 닉네임을 바꾸면 닉네임을 공개한 내 설문의 작성자 이름도 맞춘다
create function public.sync_survey_nickname()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.surveys
     set host_name = new.nickname
   where owner_id = new.id and show_nickname and not host_verified;
  return new;
end;
$$;

revoke execute on function public.sync_survey_nickname() from public, anon, authenticated;

create trigger profiles_sync_survey_nickname
  after update of nickname on public.profiles
  for each row
  when (old.nickname is distinct from new.nickname)
  execute function public.sync_survey_nickname();

-- 탈퇴로 작성자가 비면(owner_id → null) 공개했던 닉네임도 지운다 (탈퇴한 사람의 닉네임이 남지 않게)
create function public.clear_survey_nickname()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is null and new.show_nickname then
    new.show_nickname := false;
    new.host_name := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.clear_survey_nickname() from public, anon, authenticated;

create trigger surveys_clear_nickname
  before update of owner_id on public.surveys
  for each row execute function public.clear_survey_nickname();
