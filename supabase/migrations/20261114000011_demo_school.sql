-- 2026-11-14 학교 메일이 없는 테스터(친척 등)용 체험 계정 (사용자 결정: 대학생과 똑같이 모든 기능)
-- 1. universities.is_demo: 체험용 학교 표시. 가입 화면 학교 목록에서는 숨긴다 (앱에서 is_demo = false만)
-- 2. 체험 학교 "옛썰 체험" · 메일 주소 demo.yessur.test (.test는 실제로 존재할 수 없는 주소라 진짜 사람과 겹치지 않는다)
-- 계정 만들기: Supabase → Authentication → Users → Add user → guest1@demo.yessur.test · 비밀번호 · Auto Confirm 체크
--   → 앱에서 [로그인] → 가입 유형 → 약관 → 회원정보(학교는 자동으로 "옛썰 체험") → 가입 완료
-- ⚠️ 이 계정들의 설문 응답도 결과에 들어간다 (대학생과 구분하지 않음)

alter table public.universities add column is_demo boolean not null default false;

insert into public.universities (name, email_domain, is_demo)
values ('옛썰 체험', 'demo.yessur.test', true)
on conflict (email_domain) do nothing;

insert into public.university_domains (domain, university_id, is_primary)
select 'demo.yessur.test', id, true from public.universities where email_domain = 'demo.yessur.test'
on conflict (domain) do nothing;

select u.id, u.name, u.is_demo, d.domain
  from public.universities u join public.university_domains d on d.university_id = u.id
 where u.is_demo;
