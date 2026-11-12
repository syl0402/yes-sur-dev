-- 개발 중 설문 정리 (2026-11-13, review_data.sql 1번 결과 보고 정함)
-- 남길 설문: 옛썰 공식 9개(99·100·102·103·104·106·107·108·110) + 98(학생 식습관 설문)
-- 나머지([예시]·[테스트]·연습용) 전부 삭제. 문항·응답·태그·보상 연락처·스크랩·열람 기록이 같이 지워진다
-- 지우는 설문에 걸린 포인트 기록(응답 보상·등록비·환불·열람)도 같이 지운다
-- ⚠️ 98을 지우려면 아래 두 군데 목록에서 98을 빼고 실행

-- ── 1. 지우기 (한 번에 실행) ──────────────────────────────────────────
delete from public.point_ledger
 where reason in ('survey_reward', 'survey_create', 'survey_refund', 'survey_delete', 'data_view', 'data_share')
   and split_part(ref_id, ':', 1) in (
     select id::text from public.surveys
      where id not in (98, 99, 100, 102, 103, 104, 106, 107, 108, 110));

delete from public.surveys
 where id not in (98, 99, 100, 102, 103, 104, 106, 107, 108, 110);

-- ── 2. 확인: 남은 설문과 마감일 ────────────────────────────────────────
select id, left(title, 30) as title, status,
       response_count || '/' || target_responses as resp,
       to_char(closes_at at time zone 'Asia/Seoul', 'MM-DD HH24:MI') as closes
  from public.surveys
 order by id;


-- ── 3. 커뮤니티 글 지우기 (review_data.sql 2번 결과 보고 정함) ─────────────
-- 남길 글: 5 짜장vs짬뽕 · 32 노트북 · 33 통학 · 34 교수님 질문 · 35 지하철 전력 질주 · 36 시험 공부 장소 · 38 1교시vs6시
-- 지울 글: 6 나만그래? · 7 노트북(32와 중복, 보기 짧음) · 9·10 테스트 질문 · 30 테스트 홍보 · 31 Xdf · 37 설문홍보 · 39 ㅌ
-- 투표는 글과 같이 지워진다. 댓글은 글과 연결이 따로라 직접 지운다. 그 글로 받은 포인트(투표·만든 사람 보너스)도 지운다
delete from public.point_ledger
 where reason in ('community', 'creator_bonus')
   and split_part(ref_id, ':', 1) = 'post'
   and split_part(ref_id, ':', 2) in ('6', '7', '9', '10', '30', '31', '37', '39');
delete from public.comments
 where target_type = 'post' and target_id in (6, 7, 9, 10, 30, 31, 37, 39);
delete from public.posts
 where id in (6, 7, 9, 10, 30, 31, 37, 39);

select id, kind, left(question, 30) as question from public.posts order by id;


-- ── 4. 테스트 댓글 지우기 (review_data.sql 3번 결과 보고 정함) ─────────────
-- 오늘의 질문에 단 테스트 댓글: 11 Dd · 16 댓글 · 22 댓글 테스트
-- (지운 글에 달린 32·40·43·47·48·50·51·52는 3번에서 이미 지워짐. 월드컵 댓글 21·42·44는 진짜 반응이라 남김)
delete from public.comments where id in (11, 16, 22);

select count(*) as comments_left from public.comments;
