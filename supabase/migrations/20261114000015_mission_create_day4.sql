-- 2026-11-14 웰컴 미션: "내 설문 올려 보기" 11일차 → 4일차 (사용자 결정)
-- · 1주차에 설문 응답 → 설문 올리기 → 결과 보기를 한 바퀴 돌고 7일차에 의견을 받는다
-- · 일찍 올린 설문일수록 2주 동안 응답이 쌓인다
-- · 가벼운 커뮤니티 미션(투표·월드컵·글·댓글)은 2주차로
-- · 테스트 시작일 11/14라 4일차 이후는 아직 아무도 도달하지 않았다
-- 설명 문구도 고친다: 미션 보상(30P)이 가장 싼 등록비(1문항 10명 = 50P)보다 작아서 "보상이 등록비보다 커요"는 틀림
--
-- 결과 순서: 1 OX 퀴즈 · 2 관심사 · 3 설문 1개 · 4 내 설문 올려 보기 · 5 오늘의 질문 · 6 데이터 결과 · 7 의견
--           8 투표 · 9 월드컵 · 10 글 쓰기 · 11 댓글 · 12 설문 3개 · 13 결과 카드 공유 · 14 최종 피드백 설문
-- day는 고유 값이라 옮길 미션을 먼저 20번대로 비켜 둔 뒤 제자리에 놓는다

update public.missions set day = 21 where code = 'survey_create_1';
update public.missions set day = 22 where code = 'daily_1';
update public.missions set day = 23 where code = 'vote_1';
update public.missions set day = 24 where code = 'worldcup_1';
update public.missions set day = 25 where code = 'post_1';
update public.missions set day = 26 where code = 'comment_1';

update public.missions
   set day = 4,
       description = '궁금한 걸 대학생들에게 직접 물어봐요. 가입 선물 포인트로 충분히 올릴 수 있어요'
 where code = 'survey_create_1';
update public.missions set day = 5 where code = 'daily_1';
update public.missions set day = 8 where code = 'vote_1';
update public.missions set day = 9 where code = 'worldcup_1';
update public.missions set day = 10 where code = 'post_1';
update public.missions set day = 11 where code = 'comment_1';

select day, code, title, reward_key from public.missions where active order by day;
