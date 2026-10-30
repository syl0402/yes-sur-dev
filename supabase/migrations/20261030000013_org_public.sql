-- 단체 설문은 결과 공개 조건으로 등록 무료 (2026-10-30)
--
-- 단체는 포인트를 쓰지 않아 등록이 무료다(cost_survey_create_org = 0).
-- 그 대신 결과를 데이터 허브에 공개(전체 또는 우리 학교)하는 조건으로 한다. 단체 연구는 공신력이 높아 허브의 핵심 데이터.
-- 트리거라 create_survey(등록)·set_result_visibility(변경) 둘 다 막힌다.
--
-- TODO(임시): 테스트 기간 규칙 · Q14(단체 비용) 답이 오면 "나만 보기 = 유료"로 바꾼다 · docs/PROGRESS.md

create function public.check_org_visibility()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.result_visibility = 'private'
     and exists (select 1 from public.profiles where id = new.owner_id and account_type = 'org') then
    raise exception 'org_must_publish';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_org_visibility() from public, anon, authenticated;

create trigger surveys_org_visibility
  before insert or update of result_visibility on public.surveys
  for each row execute function public.check_org_visibility();
