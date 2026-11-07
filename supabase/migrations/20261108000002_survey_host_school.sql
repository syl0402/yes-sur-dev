-- 설문에 "작성자 학교" 저장 (2026-11-08 팀 피드백: "우리 학교" 칩 = 우리 학교 사람·단체가 올린 설문)
--
-- 지금 surveys.university_id는 응답 대상이 "우리 학교 학생만"일 때만 채워져서,
-- 중앙대 학생회가 "전체 대학생" 대상으로 올린 설문은 "우리 학교"에 안 보였다.
-- host_university_id = 작성자(학생 또는 교내 단체)의 학교. 학교가 없는 외부 단체는 null
-- create_survey는 그대로 두고, 저장될 때 트리거가 채운다

alter table public.surveys
  add column host_university_id bigint references public.universities (id);

-- 이미 있는 설문 채우기
update public.surveys s
   set host_university_id = p.university_id
  from public.profiles p
 where p.id = s.owner_id;

-- 새 설문: 저장 직전에 작성자 학교를 채운다 (앱이 보낸 값은 무시)
create function public.fill_survey_host_school()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.host_university_id := (select university_id from public.profiles where id = new.owner_id);
  return new;
end;
$$;

revoke execute on function public.fill_survey_host_school() from public, anon, authenticated;

create trigger surveys_fill_host_school
  before insert on public.surveys
  for each row execute function public.fill_survey_host_school();

create index surveys_host_university_idx on public.surveys (host_university_id);

-- 확인: 학교별 설문 수
select u.name, count(*) from public.surveys s
  left join public.universities u on u.id = s.host_university_id
 group by u.name order by count(*) desc;
