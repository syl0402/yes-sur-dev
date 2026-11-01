-- 설문 카테고리 7개 + 기타로 재정리 (2026-11-02)
--
-- 문제: "커뮤니티" 카테고리가 하단 탭 이름과 겹쳐 헷갈리고, 대학생 설문에 많은 진로·취업 / 연애·관계 / 사회·이슈가 없었다.
-- 변경: 3개 추가, 3개 이름 변경. community는 key를 그대로 두고 이름만 "기타"로 (이미 등록된 설문·시드 SQL이 안 깨지게).
-- 이미 있는 설문은 카테고리 연결 그대로.

insert into public.survey_categories (key, name, sort_order) values
  ('career',   '진로·취업', 2),
  ('relation', '연애·관계', 6),
  ('society',  '사회·이슈', 7);

update public.survey_categories set name = '학업',       sort_order = 1 where key = 'study';
update public.survey_categories set name = '생활',       sort_order = 3 where key = 'life';
update public.survey_categories set name = '소비·브랜드', sort_order = 4 where key = 'consume';
update public.survey_categories set name = '취향·문화',   sort_order = 5 where key = 'taste';
update public.survey_categories set name = '기타',       sort_order = 8 where key = 'community';

-- 확인
select key, name, sort_order from public.survey_categories order by sort_order;
