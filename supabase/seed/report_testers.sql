-- 테스터별 현황 (2026-11-14 비공개 테스트용)
-- 보기만 하는 SQL이다 (데이터를 바꾸지 않음). 필요할 때마다 SQL Editor에서 실행
-- 이메일은 넣지 않는다. 닉네임으로 담당 팀원이 누군지 찾는다
--
-- 마지막 활동 = 설문 응답·설문 등록·투표·글·댓글·월드컵·결과 열람·오늘의 질문·공유·의견·미션 중 가장 최근
-- 쉰 날이 3일 이상이거나 가입 후 아무것도 안 했으면 "연락"이라고 표시한다 → 담당 팀원이 안부 묻기
-- 운영자 계정은 빼고 센다

with today as (
  select (now() at time zone 'Asia/Seoul')::date as d
),
acts as (
  select user_id, submitted_at as at from public.responses
  union all select owner_id, created_at from public.surveys
  union all select user_id, created_at from public.post_votes
  union all select author_id, created_at from public.posts
  union all select author_id, created_at from public.comments
  union all select user_id, created_at from public.worldcup_plays
  union all select user_id, created_at from public.survey_views
  union all select user_id, created_at from public.daily_answers
  union all select user_id, created_at from public.share_logs
  union all select user_id, created_at from public.feedback
  union all select user_id, created_at from public.mission_claims
),
last_act as (
  select user_id, max((at at time zone 'Asia/Seoul')::date) as d
  from acts
  group by user_id
)
select p.nickname as 닉네임,
       case when u.is_demo then '체험' else '학생' end as 계정,
       to_char(p.created_at at time zone 'Asia/Seoul', 'MM/DD') as 가입일,
       (select count(*) from public.mission_claims c
         where c.user_id = p.id and c.code not like 'bonus%') as 받은_미션,
       (select count(*) from public.responses r
         where r.user_id = p.id and r.status = 'confirmed') as 설문_응답,
       to_char(l.d, 'MM/DD') as 마지막_활동,
       (select d from today) - l.d as 쉰_날,
       case
         when l.d is null then '연락 (가입 후 활동 없음)'
         when (select d from today) - l.d >= 3 then '연락'
         else ''
       end as 할_일
from public.profiles p
left join public.universities u on u.id = p.university_id
left join last_act l on l.user_id = p.id
where p.role <> 'admin'
order by l.d asc nulls first, p.created_at;
