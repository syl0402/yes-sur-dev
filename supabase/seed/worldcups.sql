-- 커뮤니티 월드컵 등록 (운영자, 2026-11-01)
-- 20261101000002_worldcup.sql 적용 후 SQL Editor에서 Run. 실행할 때마다 새로 생기니 한 번만.
-- TODO(임시): 예시 2개 · 기획팀이 테스트용 월드컵 목록을 주면 교체 · docs/PROGRESS.md
--
-- 새 월드컵 추가하는 법: 아래 블록 하나를 복사해서 제목·설명·후보만 바꾼다
--   · 후보 수는 8개 또는 16개 (size와 같아야 함), 후보 이름 30자까지, 제목 50자까지
--   · 가장 최근에 만든 월드컵이 커뮤니티 '전체' 위쪽 카드에 나온다

-- ── 1. 최고의 학식 메뉴 (8강) ──
with w as (
  insert into public.worldcups (title, description, size)
  values ('최고의 학식 메뉴는?', '오늘 점심 뭐 먹지? 대학생 최애 학식 메뉴를 골라 주세요.', 8)
  returning id
)
insert into public.worldcup_candidates (worldcup_id, sort_order, name)
select w.id, c.ord, c.name
  from w, unnest(array['돈가스', '제육덮밥', '라면', '김치찌개', '카레', '비빔밥', '쌀국수', '떡볶이'])
       with ordinality as c(name, ord);

-- ── 2. 시험 끝나면 제일 먼저 하고 싶은 것 (16강) ──
with w as (
  insert into public.worldcups (title, description, size)
  values ('시험 끝나면 제일 먼저 하고 싶은 것', '종강·시험 끝! 딱 하나만 할 수 있다면?', 16)
  returning id
)
insert into public.worldcup_candidates (worldcup_id, sort_order, name)
select w.id, c.ord, c.name
  from w, unnest(array['하루 종일 잠자기', '치킨 시켜 먹기', '노래방', 'PC방', '여행 가기', '친구랑 술 한잔',
                       '드라마 몰아보기', '쇼핑', '맛집 탐방', '운동', '카페 투어', '영화관',
                       '게임', '본가 가기', '한강 산책', '방 대청소'])
       with ordinality as c(name, ord);

-- 확인
select w.id, w.title, w.size, count(c.id) as 후보_수
  from public.worldcups w left join public.worldcup_candidates c on c.worldcup_id = w.id
 group by w.id order by w.id;
