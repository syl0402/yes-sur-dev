-- 2026-11-14 버그 수정: 골라 줘 보기를 5개까지 늘렸는데(20261114000004) 투표 기록의 보기 번호 제한이 0~3으로 남아 있어
-- 5번째 보기(번호 4)에 투표하면 오류가 났다 → 0~4로
alter table public.post_votes drop constraint post_votes_choice_check;
alter table public.post_votes add constraint post_votes_choice_check check (choice between 0 and 4);
