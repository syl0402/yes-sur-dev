-- 옛썰 이용 지표 (2026-10-31) · 운영자용, SQL Editor에서 블록 하나씩 Run
-- 테스트 기간(11/14~) 매일 확인하고, 발표 자료(12/9)에 쓴다. 데이터를 바꾸지 않는다 (읽기만)
-- 날짜는 모두 한국 시간. 개발용 계정·테스트 설문도 섞여 있으니 테스트 시작 전에 정리한다 (PROGRESS 출시 전 할 일)


-- ── 1. 한눈에 보기 ───────────────────────────────────────
select
  (select count(*) from public.profiles where account_type = 'student')                        as 학생_회원,
  (select count(*) from public.profiles where account_type = 'org' and approval_status = 'approved') as 승인된_단체,
  (select count(*) from public.surveys)                                                         as 설문,
  (select count(*) from public.responses where status = 'confirmed')                            as 응답,
  (select count(*) from public.survey_views)                                                    as 결과_열람,
  (select count(*) from public.posts where moderation <> 'deleted')                             as 커뮤니티_글,
  (select count(*) from public.post_votes)                                                      as 커뮤니티_투표,
  (select count(*) from public.comments where moderation <> 'deleted')                          as 댓글,
  (select count(*) from public.daily_answers)                                                   as 오늘의질문_답,
  (select count(*) from public.feedback)                                                        as 받은_의견,
  (select count(*) from public.reports where status = 'pending')                                as 확인_전_신고;


-- ── 2. 날짜별 (최근 14일) ────────────────────────────────
with days as (
  select generate_series((now() at time zone 'Asia/Seoul')::date - 13,
                         (now() at time zone 'Asia/Seoul')::date, interval '1 day')::date as day
),
kst as (
  select 'signup' as kind, (created_at at time zone 'Asia/Seoul')::date as day from public.profiles where account_type = 'student'
  union all select 'response', (submitted_at at time zone 'Asia/Seoul')::date from public.responses where status = 'confirmed'
  union all select 'survey', (created_at at time zone 'Asia/Seoul')::date from public.surveys
  union all select 'view', (created_at at time zone 'Asia/Seoul')::date from public.survey_views
  union all select 'vote', (created_at at time zone 'Asia/Seoul')::date from public.post_votes
  union all select 'comment', (created_at at time zone 'Asia/Seoul')::date from public.comments
  union all select 'daily', (created_at at time zone 'Asia/Seoul')::date from public.daily_answers
)
select d.day as 날짜,
       count(*) filter (where k.kind = 'signup')   as 가입,
       count(*) filter (where k.kind = 'survey')   as 설문_등록,
       count(*) filter (where k.kind = 'response') as 응답,
       count(*) filter (where k.kind = 'view')     as 열람,
       count(*) filter (where k.kind = 'vote')     as 투표,
       count(*) filter (where k.kind = 'comment')  as 댓글,
       count(*) filter (where k.kind = 'daily')    as 오늘의질문
  from days d
  left join kst k on k.day = d.day
 group by d.day
 order by d.day desc;


-- ── 3. 날마다 활동한 사람 수 (DAU) · 최근 14일 ───────────────
-- 활동 = 응답 · 투표 · 댓글 · 오늘의 질문 · 글 · 설문 등록 · 열람 중 하나라도
with acts as (
  select user_id as uid, submitted_at as at from public.responses where user_id is not null
  union all select user_id, created_at from public.post_votes where user_id is not null
  union all select author_id, created_at from public.comments where author_id is not null
  union all select user_id, created_at from public.daily_answers where user_id is not null
  union all select author_id, created_at from public.posts where author_id is not null
  union all select owner_id, created_at from public.surveys where owner_id is not null
  union all select user_id, created_at from public.survey_views where user_id is not null
)
select (at at time zone 'Asia/Seoul')::date as 날짜, count(distinct uid) as 활동한_사람
  from acts
 where at > now() - interval '14 days'
 group by 1
 order by 1 desc;


-- ── 4. 재방문: 첫 활동 다음 날 · 7일 뒤에도 활동했나 (가입한 학생 기준) ──
with acts as (
  select user_id as uid, (submitted_at at time zone 'Asia/Seoul')::date as day from public.responses where user_id is not null
  union select user_id, (created_at at time zone 'Asia/Seoul')::date from public.post_votes where user_id is not null
  union select author_id, (created_at at time zone 'Asia/Seoul')::date from public.comments where author_id is not null
  union select user_id, (created_at at time zone 'Asia/Seoul')::date from public.daily_answers where user_id is not null
),
firsts as (
  select p.id as uid, (p.created_at at time zone 'Asia/Seoul')::date as joined
    from public.profiles p where p.account_type = 'student'
)
select count(*) as 학생,
       count(*) filter (where exists (select 1 from acts a where a.uid = f.uid and a.day = f.joined + 1)) as 다음날_재방문,
       count(*) filter (where exists (select 1 from acts a where a.uid = f.uid and a.day between f.joined + 7 and f.joined + 13))
         as 일주일뒤_재방문
  from firsts f;


-- ── 5. 포인트 흐름 (인플레이션 확인) · 이유별 합계 ─────────────
-- 적립(+)이 차감(-)보다 너무 많이 쌓이면 point_rules 숫자를 조정한다
select reason as 이유, count(*) as 건수, sum(amount) as 합계, round(avg(amount)) as 평균
  from public.point_ledger
 where status = 'confirmed'
 group by reason
 order by sum(amount) desc;

-- 학생 잔액 분포
with balances as (
  select p.id, coalesce(sum(l.amount), 0) as balance
    from public.profiles p
    left join public.point_ledger l on l.user_id = p.id and l.status = 'confirmed'
   where p.account_type = 'student'
   group by p.id
)
select count(*) as 학생, round(avg(balance)) as 평균_잔액,
       percentile_cont(0.5) within group (order by balance) as 중간값,
       max(balance) as 최대
  from balances;


-- ── 6. 설문 품질 · 응답 시간 · 반려율 (확인 문항 오답 + 너무 빠른 응답, 2026-10-31) ──
select count(*) as 응답,
       round(100.0 * count(*) filter (where status = 'rejected') / nullif(count(*), 0), 1) as 반려율,
       round(avg(duration_seconds)) as 평균_응답초,
       percentile_cont(0.5) within group (order by duration_seconds) as 중간_응답초
  from public.responses;


-- ── 7. 계열 · 학년 분포 (가입 학생) ─────────────────────────
select public.respondent_group('major', id) as 계열, count(*) as 학생
  from public.profiles where account_type = 'student'
 group by 1 order by 2 desc;
