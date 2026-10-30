-- 오늘의 질문 예약 (2026-10-30 초안 · 기획팀 검토용 원문: docs/content/오늘의질문-초안.md)
-- 20261030000018_daily.sql 적용 후 실행. 날짜가 이미 있으면 건너뛴다 (여러 번 실행해도 안전)
-- 질문 100자, 보기 30자 이내

-- ── 1. 비공개 테스트 2주 (11/14 ~ 11/27) ──
insert into public.daily_questions (day, question, option_a, option_b)
select date '2026-11-14' + (n - 1), q, a, b
  from (values
    (1,  '오늘 아침밥, 먹었어요?',               '먹었다',            '안 먹었다'),
    (2,  '강의실 자리는?',                       '맨 앞자리',         '맨 뒷자리'),
    (3,  '과제는 언제 해요?',                     '미리미리',          '마감 직전'),
    (4,  '오늘 점심은?',                         '학식',              '학교 밖'),
    (5,  '카톡 답장 스타일은?',                   '바로 답장',         '몰아서 답장'),
    (6,  '시험 공부는?',                         '혼자',              '같이'),
    (7,  '조별과제에서 맡고 싶은 건?',             '발표',              '자료조사'),
    (8,  '이번 주말 계획은?',                     '집콕',              '외출'),
    (9,  '겨울에도 커피는?',                      '아이스',            '따뜻한 거'),
    (10, '1교시 수업, 어때요?',                   '괜찮다',            '절대 싫다'),
    (11, '공강 시간엔 주로?',                     '도서관',            '카페'),
    (12, '택배가 오면?',                         '바로 뜯는다',       '나중에 뜯는다'),
    (13, '여행 스타일은?',                        '계획형',            '즉흥형'),
    (14, '아침 알람은?',                         '한 번에 일어남',    '여러 번 끔')
  ) as t(n, q, a, b)
on conflict (day) do nothing;

-- ── 2. 개발 확인용 (오늘 ~ 11/13). 같은 질문을 돌려 쓴다 ──
-- ⚠️ 11/13 테스트 데이터 정리 때 지운다:
--    delete from public.daily_questions where day < date '2026-11-14';
insert into public.daily_questions (day, question, option_a, option_b)
select d::date, '[개발] ' || q.question, q.option_a, q.option_b
  from generate_series((now() at time zone 'Asia/Seoul')::date, date '2026-11-13', interval '1 day') with ordinality as g(d, i)
  join (select row_number() over (order by day) as n, question, option_a, option_b
          from public.daily_questions where day between date '2026-11-14' and date '2026-11-27') q
    on q.n = ((g.i - 1) % 14) + 1
on conflict (day) do nothing;

-- 확인
select day, question, option_a, option_b from public.daily_questions order by day limit 40;
