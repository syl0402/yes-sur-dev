-- 심사·테스트용 콘텐츠 채우기 (2026-11-13)
-- 쓰는 법: 블록(── 번호 ──)을 하나씩 SQL Editor에 붙여 Run. 각 블록은 "한 번만" (두 번 하면 같은 글이 또 생김)
-- 준비: 운영자 계정(dev_tools.sql 11번)이 있어야 한다. 글쓴이 = 옛썰 공식
--
-- 1번은 심사 기간에만 (시작일 test_start.sql 2번에서 [예시]로 지워짐)
-- 2~3번은 진짜 콘텐츠라 테스트 기간에도 그대로 둔다 (가짜 투표·응답 없음)

-- ── 1. 데이터 탭 예시 결과 5개 (심사 기간만) ─────────────────────────
-- supabase/seed/demo_hub.sql 의 do $$ … $$; 블록 전체를 복사해서 실행 (한 번만)


-- ── 2. 커뮤니티 글 6개 (밸런스 2 · 공감 2 · 골라줘 2) ────────────────
insert into public.posts (author_id, kind, question, options, body, anonymous)
select a.id, x.kind, x.question, x.options, x.body, false
  from (select id from public.profiles where role = 'admin' order by created_at limit 1) a
 cross join (values
   ('balance', '조별 과제, 어떤 팀원이 더 힘들까?',
      array['연락이 잘 안 되는 팀원', '혼자 다 바꿔 버리는 팀원'], null::text),
   ('balance', '공강 3시간 vs 수업 연강 4개',
      array['공강 3시간 버티기', '쉬는 시간 없이 연강'], null),
   ('relate', '과제 마감 하루 전에야 진짜 시작하는 사람',
      array['나도 그래', '나는 아냐'], '다들 미리 하는 줄 알았는데 나만 그런가요?'),
   ('relate', '수강신청 날 알람 3개 맞춰 놓고도 긴장돼서 일찍 깸',
      array['나도 그래', '나는 아냐'], null),
   ('pick', '시험 끝나고 제일 먼저 하고 싶은 것은?',
      array['하루 종일 잠', '친구들이랑 맛집', '밀린 드라마 정주행', '바로 여행'], null),
   ('pick', '학교 근처 점심, 뭐가 제일 좋아요?',
      array['학식', '김밥·분식', '국밥', '편의점'], null)
 ) as x(kind, question, options, body);

select id, kind, left(question, 30) as question from public.posts order by id desc limit 8;


-- ── 3. 설문 홍보글 1개 (공식 설문 99번 홍보) ──────────────────────────
-- 홍보글은 보기 없이 설문과 연결된다. 설문 하나에 홍보글 하나
insert into public.posts (author_id, kind, question, options, body, anonymous, survey_id)
select a.id, 'promo', '생성형 AI, 과제할 때 얼마나 쓰세요?', '{}'::text[],
       '대학생들의 생성형 AI 학업 활용 실태를 알아보는 설문이에요. 3분이면 끝나고 포인트도 받아요!', false, 99
  from (select id from public.profiles where role = 'admin' order by created_at limit 1) a
 where exists (select 1 from public.surveys where id = 99);

select id, kind, left(question, 30) as question, survey_id from public.posts where kind = 'promo';


-- ── 4. 확인: 오늘·내일 오늘의 질문이 있는지 ───────────────────────────
select day, left(question, 30) as question
  from public.daily_questions
 where day between (now() at time zone 'Asia/Seoul')::date and (now() at time zone 'Asia/Seoul')::date + 3
 order by day;


-- ── 5. 월드컵 4개 더 (8강 3 · 16강 1) ─────────────────────────────────
-- 한 번에 실행 (한 번만). 후보 수 = 크기, 후보 이름 30자까지. 가장 최근 것이 커뮤니티 위쪽 카드에 나온다
with w as (
  insert into public.worldcups (title, description, size)
  values ('최고의 캠퍼스 간식은?', '공강 시간, 출출할 때 딱 하나만 먹을 수 있다면?', 8)
  returning id
)
insert into public.worldcup_candidates (worldcup_id, sort_order, name)
select w.id, c.ord, c.name
  from w, unnest(array['붕어빵', '호떡', '타코야키', '컵밥', '와플', '츄러스', '닭꼬치', '핫도그'])
       with ordinality as c(name, ord);

with w as (
  insert into public.worldcups (title, description, size)
  values ('시험 기간 최애 공부 장소', '집중이 제일 잘 되는 곳은 어디인가요?', 8)
  returning id
)
insert into public.worldcup_candidates (worldcup_id, sort_order, name)
select w.id, c.ord, c.name
  from w, unnest(array['도서관 열람실', '스터디카페', '프랜차이즈 카페', '동네 개인 카페',
                       '과방', '빈 강의실', '내 방 책상', '24시 패스트푸드점'])
       with ordinality as c(name, ord);

with w as (
  insert into public.worldcups (title, description, size)
  values ('꼭 들어 보고 싶은 교양 수업', '학점 걱정 없다면 무슨 수업을 듣고 싶어요?', 8)
  returning id
)
insert into public.worldcup_candidates (worldcup_id, sort_order, name)
select w.id, c.ord, c.name
  from w, unnest(array['영화의 이해', '심리학 개론', '와인과 문화', '연애와 결혼',
                       '요가와 명상', '글쓰기의 기초', '생활 속 경제학', '별자리와 천문학'])
       with ordinality as c(name, ord);

with w as (
  insert into public.worldcups (title, description, size)
  values ('과제 끝나고 시키는 최고의 야식', '새벽 2시, 과제를 끝낸 나에게 주는 상은?', 16)
  returning id
)
insert into public.worldcup_candidates (worldcup_id, sort_order, name)
select w.id, c.ord, c.name
  from w, unnest(array['치킨', '피자', '족발', '보쌈', '떡볶이', '라면', '햄버거', '마라탕',
                       '곱창', '닭발', '편의점 도시락', '김밥', '순대', '짜장면', '회', '타코야키'])
       with ordinality as c(name, ord);

-- 확인: 월드컵마다 후보 수 = 크기
select w.id, w.title, w.size, count(c.id) as candidates
  from public.worldcups w left join public.worldcup_candidates c on c.worldcup_id = w.id
 group by w.id order by w.id;


-- ── 6. 예시 결과 "응답 0명" 고치기 (2026-11-13) ──────────────────────
-- demo_hub.sql이 확인 문항에 답을 안 넣어서 모든 응답이 결과에서 빠졌다 → 확인 문항 정답을 채운다 (여러 번 실행해도 같음)
insert into public.answers (response_id, question_id, option_ids)
select r.id, q.id, array[q.correct_option_id]
  from public.responses r
  join public.surveys s on s.id = r.survey_id and s.title like '[예시]%'
  join public.questions q on q.survey_id = r.survey_id and q.is_attention_check
 where r.status = 'confirmed'
   and not exists (select 1 from public.answers a where a.response_id = r.id and a.question_id = q.id);

select s.id, left(s.title, 30) as title, s.response_count,
       cardinality(public.survey_valid_ids(s.id)) as shown_in_results
  from public.surveys s
 where s.title like '[예시]%'
 order by s.id;
