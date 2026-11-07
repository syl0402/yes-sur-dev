-- 테스트용: [예시] 설문들에 태그 1~3개씩 붙이기 (2026-11-07)
-- 20261107000001·000002 적용 후 SQL Editor에서 Run. 여러 번 실행해도 같은 결과 (지우고 다시 붙임)
-- 설문 탭(진행 중 예시, demo_open_surveys.sql)과 데이터 탭(마감된 예시, demo_hub.sql) 모두 대상
-- 11/13 정리 때 [예시] 설문을 지우면 태그 연결도 같이 지워진다 (on delete cascade)

delete from public.survey_tags
 where survey_id in (select id from public.surveys where title like '[예시]%');

-- 설문마다 태그를 섞어서 고르고(설문 번호로 정해지는 순서), 1~3개만 남긴다.
-- 걸러 보기가 잘 보이게 앞쪽 태그 6개(연애·MBTI·학식·과제·팀플·시험·진로)에서만 고른다 → 같은 태그 설문이 여러 개 생김
insert into public.survey_tags (survey_id, tag_id)
select survey_id, tag_id
  from (
    select s.id as survey_id, g.id as tag_id,
           row_number() over (partition by s.id order by md5(s.id::text || '-' || g.id::text)) as n
      from public.surveys s
     cross join public.tags g
     where s.title like '[예시]%'
       and g.active
       and g.sort_order <= 6
  ) picked
 where n <= 1 + (survey_id % 3);

-- 확인: 설문별 태그
select s.id, s.status, left(s.title, 30) as title, string_agg('#' || g.name, ' ' order by g.sort_order) as tags
  from public.surveys s
  join public.survey_tags st on st.survey_id = s.id
  join public.tags g on g.id = st.tag_id
 where s.title like '[예시]%'
 group by s.id, s.status, s.title
 order by s.status, s.id;
