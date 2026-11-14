-- 2026-11-14 웰컴 미션: "나에 대해 알려 주세요"(관심사) 4일차 → 2일차, 이름 "관심사 알려 주기" (사용자 결정)
-- · 관심사는 맞춤 설문 추천에 쓰여 일찍 받을수록 좋다
-- · 가입 마지막 화면 이름도 "나에 대해 알려 주세요"라 겹쳐서 헷갈림 → 미션 이름을 바꾼다
-- · "오늘의 질문 답하기"는 2일차 → 4일차. 2·4일차는 아직 아무도 도달하지 않았다 (시작일 11/14)
-- day는 고유 값이라 비켜 둔 뒤 바꾼다

update public.missions set day = 29 where code = 'daily_1';
update public.missions
   set day = 2,
       title = '관심사 알려 주기',
       description = '관심 있는 주제를 고르면 나한테 맞는 설문을 먼저 보여 드려요'
 where code = 'about_me';
update public.missions set day = 4 where code = 'daily_1';

select day, code, title from public.missions where active order by day;
