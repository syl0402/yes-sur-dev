-- 옛썰 공식 설문 10개 올리기 (2026-10-30 초안 · 기획팀 검토용 원문: docs/content/공식설문-초안.md)
--
-- ⚠️ 비공개 테스트 직전(11/13)에 한 번만 실행. 너무 일찍 올리면 테스트 전에 마감된다.
-- 준비: 20261030000016_official.sql 적용 + dev_tools.sql 11번(운영자 지정)
-- 3개는 3일 마감 → 테스트 3일째쯤 데이터 탭에 첫 결과가 올라온다. 나머지 7개는 7일
-- 같은 내용을 두 번 실행하면 설문이 두 번 생기니 주의 (실행 후 맨 아래 확인 결과를 본다)

do $$
declare
  v_admin uuid := (select id from public.profiles where role = 'admin' order by created_at limit 1);
  v_cat jsonb;
begin
  if v_admin is null then
    raise exception '운영자 계정이 없어요. dev_tools.sql 11번을 먼저 실행해 주세요';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  select jsonb_object_agg(key, id) into v_cat from public.survey_categories;

  -- ── 3일 마감 (첫 결과용, 1문항) ──
  perform public.create_survey(gen_random_uuid(), (v_cat ->> 'life')::bigint,
    '점심, 주로 어디서 먹어요?', '학교 다니는 날 기준으로 골라 주세요.', 'all', 100, 3,
    '[{"type": "single", "text": "학교 가는 날 점심은 주로 어디서 먹나요?",
       "options": ["학생식당(학식)", "편의점", "교내 카페·매점", "학교 밖 식당", "거의 안 먹어요"]}]');

  perform public.create_survey(gen_random_uuid(), (v_cat ->> 'study')::bigint,
    '이번 학기 수강신청, 성공했나요?', '올해 2학기 수강신청 결과를 알려 주세요.', 'all', 100, 3,
    '[{"type": "single", "text": "이번 학기 수강신청 결과는?",
       "options": ["원하는 과목 다 성공", "대부분 성공", "절반 정도", "거의 실패", "정정 기간에 겨우 맞춤"]}]');

  perform public.create_survey(gen_random_uuid(), (v_cat ->> 'life')::bigint,
    '통학 시간, 얼마나 걸려요?', '집에서 학교까지 편도 기준이에요.', 'all', 100, 3,
    '[{"type": "single", "text": "편도 통학 시간은?",
       "options": ["15분 이내 (기숙사·자취 포함)", "15~30분", "30분~1시간", "1~2시간", "2시간 이상"]}]');

  -- ── 7일 마감 (짧은 여러 문항) ──
  perform public.create_survey(gen_random_uuid(), (v_cat ->> 'consume')::bigint,
    '대학생 알바 실태', '지금 하는 알바 기준으로 답해 주세요. 안 하면 첫 문항만 답해도 돼요.', 'all', 100, 7,
    '[{"type": "single", "text": "지금 알바를 하고 있나요?", "options": ["하고 있어요", "방학에만 해요", "지금은 안 해요", "해 본 적 없어요"]},
      {"type": "single", "text": "일주일에 몇 시간 정도 일하나요?", "options": ["안 해요", "10시간 미만", "10~20시간", "20시간 이상"]},
      {"type": "multi", "text": "알바를 하는(했던) 이유를 모두 골라 주세요", "options": ["생활비", "용돈·취미", "등록금", "경험·경력", "해당 없음"]},
      {"type": "scale", "text": "학업과 알바를 같이 하기 힘든 정도는?"}]');

  perform public.create_survey(gen_random_uuid(), (v_cat ->> 'consume')::bigint,
    '한 달 생활비, 어디에 가장 많이 써요?', '등록금·월세는 빼고 생각해 주세요.', 'all', 100, 7,
    '[{"type": "single", "text": "한 달 생활비는 대략?", "options": ["30만 원 미만", "30~50만 원", "50~80만 원", "80만 원 이상"]},
      {"type": "multi", "text": "가장 많이 쓰는 곳을 모두 골라 주세요 (최대 3개 생각)", "options": ["식비", "카페·간식", "교통비", "옷·화장품", "취미·여가", "술자리·모임", "구독 서비스"]},
      {"type": "scale", "text": "생활비가 부족하다고 느끼는 정도는?"}]');

  perform public.create_survey(gen_random_uuid(), (v_cat ->> 'study')::bigint,
    '시험 기간, 어디서 공부해요?', '이번 중간고사 기준이에요.', 'all', 100, 7,
    '[{"type": "multi", "text": "시험 기간에 주로 공부하는 곳을 모두 골라 주세요", "options": ["학교 도서관", "빈 강의실", "카페", "스터디카페", "집·기숙사"]},
      {"type": "single", "text": "이번 시험 기간에 밤샘은 몇 번?", "options": ["0번", "1~2번", "3~4번", "5번 이상"]},
      {"type": "scale", "text": "카페에서 공부하면 집중이 잘 된다"}]');

  perform public.create_survey(gen_random_uuid(), (v_cat ->> 'taste')::bigint,
    '캠퍼스 커플, 어떻게 생각해요?', '가볍게 답해 주세요.', 'all', 100, 7,
    '[{"type": "single", "text": "같은 학교 사람과의 연애(캠퍼스 커플)는?", "options": ["좋아요", "같은 과만 아니면 좋아요", "별로예요", "상관없어요"]},
      {"type": "single", "text": "소개팅·과팅 경험은?", "options": ["여러 번 있어요", "한두 번 있어요", "없어요", "말하고 싶지 않아요"]},
      {"type": "scale", "text": "대학에서 새로운 사람을 만날 기회가 충분하다"}]');

  perform public.create_survey(gen_random_uuid(), (v_cat ->> 'community')::bigint,
    '동아리 활동, 하고 있나요?', '중앙동아리·과 학회 모두 포함이에요.', 'all', 100, 7,
    '[{"type": "single", "text": "지금 동아리·학회 활동을 하나요?", "options": ["1개 하고 있어요", "2개 이상 해요", "예전에 했어요", "안 해요"]},
      {"type": "multi", "text": "동아리를 고를 때(고른다면) 중요한 것을 모두 골라 주세요", "options": ["관심 분야", "친구 사귀기", "스펙·경력", "분위기", "활동 시간 부담"]},
      {"type": "scale", "text": "동아리 활동이 대학 생활에 도움이 된다"}]');

  perform public.create_survey(gen_random_uuid(), (v_cat ->> 'study')::bigint,
    '진로, 얼마나 정했어요?', '지금 마음 기준으로 답해 주세요.', 'all', 100, 7,
    '[{"type": "scale", "text": "졸업 후 진로를 정한 정도는? (1 전혀 못 정함 ~ 5 확실히 정함)"},
      {"type": "multi", "text": "진로 고민에서 가장 큰 것을 모두 골라 주세요", "options": ["하고 싶은 일을 모름", "취업 경쟁", "전공과 맞지 않음", "경제적 부담", "정보 부족"]},
      {"type": "multi", "text": "진로 정보를 주로 어디서 얻나요?", "options": ["선배·친구", "유튜브·SNS", "학교 취업센터", "교수님", "커뮤니티(에타 등)"]}]');

  perform public.create_survey(gen_random_uuid(), (v_cat ->> 'community')::bigint,
    '옛썰 써 보니 어때요?', '테스트 기간 동안 써 본 느낌을 알려 주세요. 앱을 더 좋게 만드는 데 써요.', 'all', 100, 7,
    '[{"type": "multi", "text": "가장 좋았던 기능을 모두 골라 주세요", "options": ["설문 응답·포인트", "설문 만들기", "데이터 탭(결과 보기)", "내 답 비교", "오늘의 질문·밸런스 게임"]},
      {"type": "scale", "text": "앱을 쓰기 편했다"},
      {"type": "scale", "text": "친구에게 추천하고 싶다"},
      {"type": "text", "text": "불편했던 점이나 바라는 점을 자유롭게 적어 주세요"}]');
end;
$$;

-- 확인: 방금 올라간 공식 설문
select id, title, host_name, closes_at::date as closes, question_count
  from public.surveys
 where host_name = '옛썰 공식'
 order by id desc
 limit 10;
