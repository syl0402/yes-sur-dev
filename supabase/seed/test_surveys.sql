-- 개발용 테스트 설문 3개 (마이그레이션 아님, 실제 서비스 데이터 아님)
-- 1단계에는 설문 작성 화면이 없어서, 목록·응답·보상 확인용으로 직접 넣는다
-- 작성자: 단체 테스터 계정 (학생 테스터가 응답할 수 있게)
-- 실행: Supabase SQL Editor에 붙여넣고 Run (한 번만. 다시 넣으려면 맨 아래 정리 SQL 먼저)

do $$
declare
  v_owner uuid;
  v_cau bigint;
  v_survey bigint;
  v_question bigint;
begin
  -- 단체 테스터 계정 (가입을 마친 계정이어야 함)
  select p.id into v_owner
    from auth.users u
    join public.profiles p on p.id = u.id
   where u.email = 'esteeaine@gmail.com';

  if v_owner is null then
    raise exception '단체 테스터 계정의 회원정보가 없습니다. 앱에서 단체 가입을 먼저 마쳐 주세요.';
  end if;

  select id into v_cau from public.universities where email_domain = 'cau.ac.kr';

  -- ① 전체 대상, 4문항, 3분 → 5분 미만 보상
  insert into public.surveys
    (owner_id, category_id, title, description, question_count, est_minutes,
     reward_points, target_responses, audience, closes_at)
  values
    (v_owner, (select id from public.survey_categories where key = 'study'),
     '대학생 스터디 습관 조사', '평소 공부 방식과 스터디 참여 경험을 묻는 설문이에요.', 4, 3,
     public.calc_survey_reward(4, 3), 30, 'all', now() + interval '7 days')
  returning id into v_survey;

  insert into public.questions (survey_id, sort_order, text) values (v_survey, 1, '스터디를 시작한 이유로 가장 가까운 것은?') returning id into v_question;
  insert into public.question_options (question_id, sort_order, text) values
    (v_question, 1, '시험 대비'), (v_question, 2, '전공 이해 보완'), (v_question, 3, '동기부여·친목'), (v_question, 4, '취업 준비');

  insert into public.questions (survey_id, sort_order, text) values (v_survey, 2, '일주일에 스터디를 몇 번 하나요?') returning id into v_question;
  insert into public.question_options (question_id, sort_order, text) values
    (v_question, 1, '안 함'), (v_question, 2, '1번'), (v_question, 3, '2~3번'), (v_question, 4, '4번 이상');

  insert into public.questions (survey_id, sort_order, text) values (v_survey, 3, '주로 공부하는 장소는?') returning id into v_question;
  insert into public.question_options (question_id, sort_order, text) values
    (v_question, 1, '도서관'), (v_question, 2, '카페'), (v_question, 3, '집'), (v_question, 4, '강의실');

  insert into public.questions (survey_id, sort_order, text) values (v_survey, 4, '스터디가 성적에 도움이 된다고 느끼나요?') returning id into v_question;
  insert into public.question_options (question_id, sort_order, text) values
    (v_question, 1, '매우 그렇다'), (v_question, 2, '그렇다'), (v_question, 3, '보통'), (v_question, 4, '아니다');

  -- ② 우리 학교만(중앙대), 3문항, 2분
  insert into public.surveys
    (owner_id, category_id, title, description, question_count, est_minutes,
     reward_points, target_responses, audience, university_id, closes_at)
  values
    (v_owner, (select id from public.survey_categories where key = 'life'),
     '중앙대 학식 만족도', '중앙대 학생만 응답할 수 있는 학식 설문이에요.', 3, 2,
     public.calc_survey_reward(3, 2), 30, 'campus', v_cau, now() + interval '3 days')
  returning id into v_survey;

  insert into public.questions (survey_id, sort_order, text) values (v_survey, 1, '학식을 일주일에 몇 번 먹나요?') returning id into v_question;
  insert into public.question_options (question_id, sort_order, text) values
    (v_question, 1, '안 먹음'), (v_question, 2, '1~2번'), (v_question, 3, '3~4번'), (v_question, 4, '거의 매일');

  insert into public.questions (survey_id, sort_order, text) values (v_survey, 2, '학식 가격은 어떤가요?') returning id into v_question;
  insert into public.question_options (question_id, sort_order, text) values
    (v_question, 1, '싸다'), (v_question, 2, '적당하다'), (v_question, 3, '비싸다');

  insert into public.questions (survey_id, sort_order, text) values (v_survey, 3, '학식 맛은 어떤가요?') returning id into v_question;
  insert into public.question_options (question_id, sort_order, text) values
    (v_question, 1, '맛있다'), (v_question, 2, '보통'), (v_question, 3, '별로다');

  -- ③ 1문항, 목표 1명 → 첫 응답에 자동 마감되는지 확인용
  insert into public.surveys
    (owner_id, category_id, title, description, question_count, est_minutes,
     reward_points, target_responses, audience, closes_at)
  values
    (v_owner, (select id from public.survey_categories where key = 'taste'),
     '한 줄 취향: 부먹 vs 찍먹', '1문항짜리 짧은 설문이에요.', 1, 1,
     public.calc_survey_reward(1, 1), 1, 'all', now() + interval '1 day')
  returning id into v_survey;

  insert into public.questions (survey_id, sort_order, text) values (v_survey, 1, '탕수육은?') returning id into v_question;
  insert into public.question_options (question_id, sort_order, text) values
    (v_question, 1, '부먹'), (v_question, 2, '찍먹');
end;
$$;

-- 정리 (테스트 설문·응답·설문 보상 기록을 지울 때만 따로 실행)
-- delete from public.point_ledger where reason = 'survey_reward';
-- delete from public.surveys where owner_id = (select id from auth.users where email = 'esteeaine@gmail.com');
