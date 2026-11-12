-- 비공개 테스트 시작일 아침 정리 (2026-11-13 작성)
-- ⚠️ Google 검토 통과 → 테스터가 들어오기 직전에 "한 번만" 실행. 실제 사용자가 생긴 뒤에는 쓰지 않는다
--
-- 왜 시작일에: 공식 설문 3개는 3일 마감이라 일찍 올리면 테스트 초반에 마감된다.
--              심사관이 보는 동안에는 지금 데이터가 있는 게 빈 화면보다 낫다
--
-- 준비 (전날까지):
--   · 앱에서 팀 메일(yessur.team@gmail.com)로 "단체" 가입 (단체 이름: 옛썰) → dev_tools.sql 11번 실행 (운영자 지정)
--
-- 쓰는 법: 블록(── 번호 ──)을 위에서부터 하나씩 복사 → SQL Editor → Run → 맨 아래 확인 결과 보기

-- ── 1. 웰컴 미션 시작일을 오늘로 + 미리보기 기록 지우기 ─────────────
-- 시작일은 서울 날짜 기준 오늘 (테스터가 처음 여는 날이 1일차)
update public.point_rules
   set value = to_char((now() at time zone 'Asia/Seoul')::date, 'YYYYMMDD')::numeric
 where key = 'mission_launch_date';
delete from public.point_ledger where reason in ('mission', 'mission_bonus');
delete from public.mission_claims;
delete from public.mission_progress;
-- profile_extras(나에 대해 답)는 남긴다

select value as mission_launch_date from public.point_rules where key = 'mission_launch_date';


-- ── 2. 개발 중 쌓인 설문 지우기 ([예시]·[테스트] 포함) · "옛썰 공식"(운영자) 설문은 남긴다 (2026-11-13) ──
-- 설문과 함께 문항·응답·태그·보상 연락처·스크랩·열람 기록이 같이 지워진다
-- 포인트는 지우는 설문에 걸린 기록만 지운다 (ref_id 앞부분 = 설문 번호, data_share는 "설문번호:열람번호")
-- 공식 설문에 응답하고 받은 포인트, 웰컴·커뮤니티·오늘의 질문·출석·초대는 남긴다
delete from public.point_ledger
 where reason in ('survey_reward', 'survey_create', 'survey_refund', 'survey_delete', 'data_view', 'data_share')
   and split_part(ref_id, ':', 1) in (
     select s.id::text from public.surveys s
       join public.profiles p on p.id = s.owner_id
      where p.role is distinct from 'admin' and s.id <> 98);
-- 98 = 학생이 올린 식습관 설문 (2026-11-13 남기기로 함)
delete from public.surveys s
 using public.profiles p
 where p.id = s.owner_id and p.role is distinct from 'admin' and s.id <> 98;
-- 심사 기간에 데이터 탭을 채우려고 다시 올린 [예시] 설문(demo_hub.sql)은 작성자와 상관없이 지운다 (2026-11-13)
delete from public.surveys where title like '[예시]%';
-- 작성자 프로필이 없는(탈퇴한) 설문도 지운다
delete from public.surveys s
 where not exists (select 1 from public.profiles p where p.id = s.owner_id);

select (select count(*) from public.surveys) as surveys_left_official_only,
       (select count(*) from public.surveys s join public.profiles p on p.id = s.owner_id where p.role = 'admin') as official;


-- ── 2-1. 공식 설문 마감 연장 (테스트 시작 때 진행 중이어야 함, 2026-11-13) ──────
-- 진행 중인 공식 설문 중 마감이 7일 안으로 남은 것은 오늘부터 7일 뒤로 미룬다 (이미 마감 처리된 것은 그대로)
update public.surveys s
   set closes_at = now() + interval '7 days'
  from public.profiles p
 where p.id = s.owner_id and p.role = 'admin'
   and s.status = 'open'
   and s.response_count < s.target_responses
   and (s.closes_at is null or s.closes_at < now() + interval '7 days');

select s.id, left(s.title, 30) as title, s.status,
       to_char(s.closes_at at time zone 'Asia/Seoul', 'MM-DD HH24:MI') as closes
  from public.surveys s join public.profiles p on p.id = s.owner_id
 where p.role = 'admin'
 order by s.id;


-- ── 3. 개발용 오늘의 질문 지우기 (어제까지) ─────────────────────────
-- 오늘·앞으로의 질문(기획팀 검토본)은 남긴다. 답은 같이 지워지고, 댓글은 연결이 따로라 먼저 지운다
delete from public.comments
 where target_type = 'daily'
   and target_id in (select id from public.daily_questions where day < (now() at time zone 'Asia/Seoul')::date);
delete from public.daily_questions
 where day < (now() at time zone 'Asia/Seoul')::date;

select min(day) as first_day, max(day) as last_day, count(*) as questions from public.daily_questions;


-- ── 4. 데이터 탭 공개 기준 5명으로 되돌리기 ─────────────────────────
update public.point_rules set value = 5 where key = 'result_min_count';

select key, value from public.point_rules where key = 'result_min_count';


-- ── 5. 공식 설문 10개 올리기 ────────────────────────────────────────
-- 11/9에 올린 공식 9개와는 다른 설문 10개 (3일 마감 3개 → 테스트 3일째쯤 데이터 탭 첫 결과)
-- ⚠️ 한 번만! 아래 결과가 0이면 실행, 1 이상이면 이미 올린 것이라 건너뛴다
select count(*) as already_uploaded from public.surveys where title = '점심, 주로 어디서 먹어요?';
-- → 0이면 supabase/seed/official_surveys.sql 파일 전체를 복사해서 실행


-- ── 6. 최종 확인 ────────────────────────────────────────────────────
select (select count(*) from public.surveys) as surveys,
       (select count(*) from public.surveys s join public.profiles p on p.id = s.owner_id where p.role = 'admin') as official,
       (select value from public.point_rules where key = 'result_min_count') as result_min_count,
       (select value from public.point_rules where key = 'mission_launch_date') as mission_launch_date;
