-- 개발·테스트 도구 모음 (2026-10-30)
-- ⚠️ 테스트 기간 전용. 실제 사용자가 생기면 쓰지 않는다 (데이터를 지우거나 포인트를 넣는다)
--
-- 쓰는 법: 필요한 블록(── 번호 ── 부터 다음 번호 전까지)만 복사 → SQL Editor 새 탭 → Run
-- 테스터는 메일 없이 자동으로 찾는다
--   학생 테스터 = 가장 먼저 가입한 학생 / 단체 테스터 = 가장 먼저 가입한 단체
-- SQL Editor는 마지막 문장 결과만 보여주므로 블록마다 끝에 확인용 select가 있다


-- ── 0. 지금 상태 보기 ─────────────────────────────────────
-- 테스터 계정 · 종류 · 승인 · 잔액
select u.email, p.account_type, p.approval_status,
       coalesce((select sum(amount) from public.point_ledger l
                  where l.user_id = p.id and l.status = 'confirmed'), 0) as balance
  from public.profiles p
  join auth.users u on u.id = p.id
 order by p.created_at;


-- ── 1. 최근 설문 보기 ─────────────────────────────────────
select id, title, coalesce(host_name, '개인') as host, status,
       response_count || ' / ' || target_responses as responses,
       closes_at
  from public.surveys
 order by id desc
 limit 15;


-- ── 2. 학생 테스터에게 포인트 1,000P 넣기 (여러 번 실행 가능) ──
insert into public.point_ledger (user_id, amount, status, reason, ref_id)
values (
  (select id from public.profiles where account_type = 'student' order by created_at limit 1),
  1000, 'confirmed', 'survey_reward', 'dev-' || extract(epoch from clock_timestamp())::bigint
);

select coalesce(sum(amount), 0) as student_balance
  from public.point_ledger
 where status = 'confirmed'
   and user_id = (select id from public.profiles where account_type = 'student' order by created_at limit 1);


-- ── 3. 단체 설문 1개 만들기 (작성자 = 단체 테스터, 비용 0) ────
-- 제목·대상만 바꿔서 여러 번 실행해도 된다. 문항은 4종 섞인 6개 (+ 확인용 1개 자동)
do $$
declare
  v_org uuid := (select id from public.profiles
                  where account_type = 'org' and approval_status = 'approved'
                  order by created_at limit 1);
begin
  if v_org is null then
    raise exception '승인된 단체 테스터가 없어요 (6번으로 승인)';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);

  perform public.create_survey(gen_random_uuid(),
    (select id from public.survey_categories where key = 'life'),
    '[테스트] 단체 설문 ' || to_char(now() at time zone 'Asia/Seoul', 'MM/DD HH24:MI'),  -- 제목
    '개발용 단체 설문이에요.',
    'all',   -- 응답 대상: 'all' 전체 / 'campus' 우리 학교만
    30,      -- 목표 인원 (10~300)
    7,       -- 마감까지 일수 (1~14)
    '[
      {"type": "single", "text": "하나 고르기 문항", "options": ["보기 1", "보기 2", "보기 3"]},
      {"type": "multi",  "text": "여러 개 고르기 문항", "options": ["가", "나", "다", "라"]},
      {"type": "scale",  "text": "5점 척도 문항"},
      {"type": "text",   "text": "주관식 문항"},
      {"type": "single", "text": "하나 더", "options": ["예", "아니요"]},
      {"type": "scale",  "text": "척도 하나 더"}
    ]');
end;
$$;

select id, title, host_name, reward_points from public.surveys order by id desc limit 1;


-- ── 4. 개인(학생) 설문 1개 만들기 (작성자 = 학생 테스터) ─────
-- 등록비(3문항·1분 → 1명당 15P × 30명 = 450P)가 빠진다. 잔액이 모자라면 먼저 자동으로 채운다
-- 참고: 학생 테스터는 자기 설문에 응답할 수 없다. 응답 테스트는 다른 학생 계정으로
do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_balance integer;
begin
  if v_student is null then
    raise exception '학생 테스터가 없어요';
  end if;

  select coalesce(sum(amount), 0) into v_balance
    from public.point_ledger where user_id = v_student and status = 'confirmed';
  if v_balance < public.calc_survey_price(3, 1) * 30 then
    insert into public.point_ledger (user_id, amount, status, reason, ref_id)
    values (v_student, 1000, 'confirmed', 'survey_reward', 'dev-' || extract(epoch from clock_timestamp())::bigint);
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);

  perform public.create_survey(gen_random_uuid(),
    (select id from public.survey_categories where key = 'study'),
    '[테스트] 개인 설문 ' || to_char(now() at time zone 'Asia/Seoul', 'MM/DD HH24:MI'),
    '개발용 개인 설문이에요.',
    'all', 30, 7,
    '[
      {"type": "single", "text": "하나 고르기 문항", "options": ["보기 1", "보기 2"]},
      {"type": "scale",  "text": "5점 척도 문항"},
      {"type": "text",   "text": "주관식 문항"}
    ]');
end;
$$;

select id, title, coalesce(host_name, '개인') as host, reward_points from public.surveys order by id desc limit 1;


-- ── 5. 학생 테스터의 응답 모두 지우기 (같은 설문 다시 응답하기) ──
-- 응답·답변·설문 보상 기록을 지우고, 설문 응답 수를 다시 세서 자리가 생기면 다시 연다
do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
begin
  delete from public.point_ledger
   where user_id = v_student and reason = 'survey_reward' and ref_id ~ '^\d+$';
  delete from public.responses where user_id = v_student;

  update public.surveys s
     set response_count = c.cnt,
         status = case
                    when c.cnt < s.target_responses and (s.closes_at is null or s.closes_at > now()) then 'open'
                    else s.status
                  end
    from (select s2.id, (select count(*) from public.responses r where r.survey_id = s2.id and r.status = 'confirmed')::integer as cnt
            from public.surveys s2) c
   where c.id = s.id;
end;
$$;

select count(*) as my_responses_left
  from public.responses
 where user_id = (select id from public.profiles where account_type = 'student' order by created_at limit 1);


-- ── 6. 단체 테스터 승인 상태 바꾸기 ─────────────────────────
-- 'approved' 승인 / 'pending' 대기 / 'rejected' 거절 중 하나로 바꿔서 실행
update public.profiles
   set approval_status = 'approved'
 where id = (select id from public.profiles where account_type = 'org' order by created_at limit 1);

select account_type, approval_status
  from public.profiles
 where id = (select id from public.profiles where account_type = 'org' order by created_at limit 1);


-- ── 7. 설문 하나를 "곧 마감" / "마감" / "다시 열기"로 만들기 ────
-- 맨 아래 id를 1번 결과에서 보고 바꾼다. 원하는 줄 하나만 남기고 실행
update public.surveys set closes_at = now() + interval '30 minutes' where id = 0;            -- 곧 마감
-- update public.surveys set status = 'closed' where id = 0;                                 -- 마감
-- update public.surveys set status = 'open', closes_at = now() + interval '7 days' where id = 0;  -- 다시 열기

select id, title, status, closes_at from public.surveys where id = 0;


-- ── 8. [테스트] 설문 모두 지우기 ───────────────────────────
-- 설문과 그 문항·응답이 같이 지워진다. 관련 포인트 기록(응답 보상·등록비)도 지운다
delete from public.point_ledger
 where reason in ('survey_reward', 'survey_create')
   and ref_id in (select id::text from public.surveys where title like '[테스트]%');
delete from public.surveys where title like '[테스트]%';

select count(*) as test_surveys_left from public.surveys where title like '[테스트]%';


-- ── 9. 개발 데이터 전부 초기화 (설문·응답·포인트 기록. 웰컴 500P만 남김) ──
-- 2026-10-30 포인트 규칙을 바꾼 뒤 예전 규칙으로 쌓인 데이터를 지울 때.
-- ⚠️ 모든 사람의 설문·응답이 지워진다. 실제 사용자가 생긴 뒤에는 절대 쓰지 않는다
-- 실행 후 test_surveys_mixed.sql로 테스트 설문을 새 규칙으로 다시 만든다
delete from public.point_ledger where reason <> 'welcome';
delete from public.surveys;

select (select count(*) from public.surveys) as surveys_left,
       (select count(*) from public.point_ledger) as ledger_rows_left;
