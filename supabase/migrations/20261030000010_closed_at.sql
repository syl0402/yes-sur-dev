-- 일찍 마감하면 마감일을 그 순간으로 (2026-10-30)
--
-- 문제: [응답 마감하기]나 목표 인원 도달로 일찍 마감해도 closes_at(마감 예정일)이 미래 날짜로 남아
--       데이터 허브에 "2026.11.06 마감"처럼 아직 오지 않은 날짜가 보였다.
-- 해결: 상태가 진행 중 → 마감으로 바뀔 때, 마감 예정일이 아직 안 지났으면 지금으로 바꾼다 (트리거).
--       close_survey·submit_response(자동 마감)를 고치지 않아도 둘 다 적용된다.

create function public.set_survey_closed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'open' and new.status = 'closed'
     and (new.closes_at is null or new.closes_at > now()) then
    new.closes_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.set_survey_closed_at() from public, anon, authenticated;

create trigger surveys_set_closed_at
  before update of status on public.surveys
  for each row execute function public.set_survey_closed_at();

-- 이미 일찍 마감된 설문도 바로잡는다 (정확한 마감 시각은 남아 있지 않아 지금으로)
update public.surveys
   set closes_at = now()
 where status = 'closed'
   and (closes_at is null or closes_at > now());
