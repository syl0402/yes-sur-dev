-- 카테고리별 추천 태그 (2026-11-12 설문 흐름 개선안 register/Main: 카테고리를 고르면 그 카테고리 추천 태그 6개 + 더보기)
--
-- 태그 자체(tags)와 붙이기(set_survey_tags)는 그대로. "어떤 카테고리에서 어떤 태그를 먼저 보여 줄지"만 담는 참고용 표
-- 추천 목록을 바꾸려면 이 표만 고치면 된다 (앱 업데이트 필요 없음)
-- 카테고리는 이름이 아니라 key로, 태그는 이름으로 찾는다 (없는 이름은 조용히 빠짐)

create table public.category_tag_suggestions (
  category_id bigint not null references public.survey_categories (id) on delete cascade,
  tag_id bigint not null references public.tags (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (category_id, tag_id)
);

alter table public.category_tag_suggestions enable row level security;

-- 읽기만. 쓰기 정책 없음 = 앱에서는 바꿀 수 없다 (운영자가 SQL로)
create policy "로그인한 사람은 추천 태그를 읽을 수 있다"
  on public.category_tag_suggestions for select
  to authenticated
  using (true);

-- 이 프로젝트는 새 표를 앱이 읽으려면 grant가 따로 필요하다 (20261107000002 참고). 쓰기는 주지 않는다
grant select on public.category_tag_suggestions to authenticated;

insert into public.category_tag_suggestions (category_id, tag_id, sort_order)
select c.id, t.id, s.ord
  from (values
    ('study',     '과제·팀플', 1), ('study',     '시험·성적', 2), ('study',     '수강신청', 3),
    ('study',     '학식', 4),      ('study',     '동아리·학회', 5), ('study',   '통학', 6),

    ('career',    '대외활동·인턴', 1), ('career', '자격증', 2), ('career', '알바·과외', 3),
    ('career',    '시험·성적', 4),  ('career',    '돈관리·재테크', 5), ('career', '동아리·학회', 6),

    ('life',      '자취·기숙사', 1), ('life',     '통학', 2),     ('life',      '학식', 3),
    ('life',      '음식·카페', 4),  ('life',      '알바·과외', 5), ('life',     '돈관리·재테크', 6),

    ('consume',   '음식·카페', 1),  ('consume',   '패션·뷰티', 2), ('consume',  '돈관리·재테크', 3),
    ('consume',   '트렌드·밈', 4),  ('consume',   '여행', 5),     ('consume',   '취미', 6),

    ('taste',     '취미', 1),       ('taste',     '여가시간', 2), ('taste',     '여행', 3),
    ('taste',     '트렌드·밈', 4),  ('taste',     'MBTI', 5),     ('taste',     '음식·카페', 6),

    ('relation',  '썸·연애', 1),    ('relation',  '인간관계', 2), ('relation',  'MBTI', 3),
    ('relation',  '축제·MT', 4),    ('relation',  '동아리·학회', 5), ('relation', '여가시간', 6),

    ('society',   '트렌드·밈', 1),  ('society',   '돈관리·재테크', 2), ('society', '통학', 3),
    ('society',   '자취·기숙사', 4), ('society',  '알바·과외', 5), ('society',  '인간관계', 6),

    ('community', 'MBTI', 1),       ('community', '취미', 2),     ('community', '여가시간', 3),
    ('community', '트렌드·밈', 4),  ('community', '음식·카페', 5), ('community', '여행', 6)
  ) as s(category_key, tag_name, ord)
  join public.survey_categories c on c.key = s.category_key
  join public.tags t on t.name = s.tag_name and t.active;

-- 확인: 카테고리마다 6개씩 (8 × 6 = 48줄)
select c.name, count(*) as tags
  from public.category_tag_suggestions x
  join public.survey_categories c on c.id = x.category_id
 group by c.name, c.sort_order
 order by c.sort_order;
