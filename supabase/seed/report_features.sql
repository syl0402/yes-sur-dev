-- 기능별 사용 수 (2026-11-14 비공개 테스트용)
-- 보기만 하는 SQL이다 (데이터를 바꾸지 않음). 필요할 때마다 SQL Editor에서 실행
-- 개인을 알 수 있는 정보 없이 사람 수와 횟수만 센다
--
-- 테스트 시작일(11/14) 이후 기록만 센다. 날짜를 바꾸려면 아래 since 한 곳만 고친다
-- 운영자 계정이 한 것은 뺀다 (공식 설문 등록 등)

with since as (
  select timestamptz '2026-11-14 00:00+09' as at
),
staff as (
  select id from public.profiles where role = 'admin'
),
acts as (
  select '01. 설문 응답' as 기능, user_id, submitted_at as at from public.responses where status = 'confirmed'
  union all select '02. 설문 올리기', owner_id, created_at from public.surveys
  union all select '03. 데이터 결과 보기', user_id, created_at from public.survey_views
  union all select '04. 오늘의 질문', user_id, created_at from public.daily_answers
  union all select '05. 커뮤니티 투표', user_id, created_at from public.post_votes
  union all select '06. 커뮤니티 글 쓰기', author_id, created_at from public.posts where moderation <> 'removed'
  union all select '07. 댓글', author_id, created_at from public.comments where moderation not in ('removed', 'deleted')
  union all select '08. 월드컵', user_id, created_at from public.worldcup_plays
  union all select '09. 결과 카드 공유', user_id, created_at from public.share_logs
  union all select '10. 의견 보내기', user_id, created_at from public.feedback
)
select 기능,
       count(distinct user_id) as 써_본_사람,
       count(*) as 횟수
from acts
where at >= (select at from since)
  and user_id not in (select id from staff)
group by 기능

union all

-- 비교 기준: 전체 테스터 수 (운영자 빼고)
select '00. 전체 테스터', count(*), null
from public.profiles
where role <> 'admin'

order by 1;
