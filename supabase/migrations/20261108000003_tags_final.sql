-- 설문 태그 확정 목록 21개 (2026-11-08 기획팀)
-- 20261107000001의 임시 20개를 바꾼다.
--   - 뜻이 같은 태그는 이름만 바꿔서 이미 붙은 설문 연결을 그대로 둔다
--   - 목록에서 빠진 태그는 숨기고(active=false) 설문에 붙은 것도 뗀다 (화면마다 보였다 안 보였다 하지 않게)
--   - 새 태그는 추가. 순서(sort_order)는 기획팀 목록 순서

-- 1. 이름 바꾸기 (임시 이름 → 확정 이름)
update public.tags set name = '시험·성적'     where name = '시험';
update public.tags set name = '자취·기숙사'   where name = '자취';
update public.tags set name = '알바·과외'     where name = '알바';
update public.tags set name = '돈관리·재테크' where name = '돈 관리';
update public.tags set name = '운동·건강'     where name = '운동';
update public.tags set name = '썸·연애'       where name = '연애';
update public.tags set name = '동아리·학회'   where name = '동아리';
update public.tags set name = '음식·카페'     where name = '음식';

-- 2. 새 태그 추가 (이미 있으면 그대로)
insert into public.tags (name) values
  ('수강신청'), ('대외활동·인턴'), ('자격증'), ('인간관계'), ('축제·MT'), ('패션·뷰티'), ('트렌드·밈')
on conflict (name) do nothing;

-- 3. 확정 순서 + 다시 켜기
update public.tags t
   set sort_order = o.ord, active = true
  from (values
    ('과제·팀플', 1), ('시험·성적', 2), ('수강신청', 3), ('대외활동·인턴', 4), ('자격증', 5),
    ('자취·기숙사', 6), ('통학', 7), ('알바·과외', 8), ('돈관리·재테크', 9), ('학식', 10),
    ('다이어트', 11), ('운동·건강', 12), ('썸·연애', 13), ('MBTI', 14), ('인간관계', 15),
    ('동아리·학회', 16), ('축제·MT', 17), ('음식·카페', 18), ('패션·뷰티', 19), ('여행', 20),
    ('트렌드·밈', 21)
  ) as o(name, ord)
 where t.name = o.name;

-- 4. 목록에 없는 태그(진로·취업·수면·취미·게임·SNS)는 떼고 숨기기
delete from public.survey_tags
 where tag_id in (select id from public.tags where name not in (
   '과제·팀플', '시험·성적', '수강신청', '대외활동·인턴', '자격증', '자취·기숙사', '통학', '알바·과외',
   '돈관리·재테크', '학식', '다이어트', '운동·건강', '썸·연애', 'MBTI', '인간관계', '동아리·학회',
   '축제·MT', '음식·카페', '패션·뷰티', '여행', '트렌드·밈'));
update public.tags set active = false, sort_order = 999
 where name not in (
   '과제·팀플', '시험·성적', '수강신청', '대외활동·인턴', '자격증', '자취·기숙사', '통학', '알바·과외',
   '돈관리·재테크', '학식', '다이어트', '운동·건강', '썸·연애', 'MBTI', '인간관계', '동아리·학회',
   '축제·MT', '음식·카페', '패션·뷰티', '여행', '트렌드·밈');

-- 확인: 쓰는 태그 21개 (순서대로)
select sort_order, name from public.tags where active order by sort_order;
