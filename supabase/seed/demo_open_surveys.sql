-- 설문 탭 예시: 진행 중인 [예시] 설문 8개 (2026-11-03)
-- 회의·팀 미리보기 때 설문 탭이 비어 보이지 않게. 카테고리 7개와 보상 구간 5개(10·30·60·100P)를 골고루
-- 작성자: 승인된 단체 테스터들을 돌아가며 (단체는 등록비 0, 결과는 전체 공개). 마감 10일 뒤 (11/13 전후)
-- ⚠️ 개발 전용. 11/13 정리 때 `delete from public.surveys where title like '[예시]%';`로 데이터 탭 예시와 같이 지운다
-- 만드는 법: do 블록 전체를 SQL Editor에 붙여 넣고 Run (여러 번 실행하면 그만큼 또 생긴다)

do $$
declare
  v_orgs uuid[] := (select array_agg(id order by created_at) from public.profiles
                     where account_type = 'org' and approval_status = 'approved');
  v_cat jsonb := (select jsonb_object_agg(key, id) from public.survey_categories);
  v_spec jsonb := $spec$[
    {"title": "[예시] 오늘 아침, 뭐 먹었어요?", "category": "life", "target": 100,
     "desc": "1문항이라 5초면 끝나요.",
     "questions": [
       {"type": "single", "text": "오늘 아침은?", "options": ["밥", "빵·시리얼", "커피만", "편의점", "안 먹었어요"]}]},

    {"title": "[예시] 시험 기간, 어디서 공부해요?", "category": "study", "target": 80,
     "desc": "중간·기말고사 기간 기준으로 답해 주세요.",
     "questions": [
       {"type": "single", "text": "시험 기간에 가장 많이 공부하는 곳은?", "options": ["학교 도서관", "스터디카페", "카페", "집·기숙사", "빈 강의실"]},
       {"type": "single", "text": "하루 평균 공부 시간은?", "options": ["2시간 미만", "2~4시간", "4~6시간", "6시간 이상"]},
       {"type": "multi", "text": "공부할 때 꼭 필요한 것을 모두 골라 주세요", "options": ["음악", "커피", "간식", "타이머", "친구"]},
       {"type": "scale", "text": "시험 기간 스트레스는 어느 정도인가요?"}]},

    {"title": "[예시] 첫 직장, 무엇을 보고 고를래요?", "category": "career", "target": 100,
     "desc": "졸업 후 첫 직장을 고르는 기준을 알아봐요.",
     "questions": [
       {"type": "single", "text": "가장 중요한 기준 하나만 고르면?", "options": ["연봉", "워라밸", "성장 가능성", "회사 안정성", "위치·통근"]},
       {"type": "multi", "text": "포기할 수 없는 조건을 모두 골라 주세요", "options": ["재택근무", "유연 출퇴근", "식대·복지", "높은 연봉", "좋은 동료"]},
       {"type": "single", "text": "희망하는 첫 연봉은?", "options": ["3천만 원 미만", "3~4천만 원", "4~5천만 원", "5천만 원 이상"]},
       {"type": "single", "text": "대기업과 스타트업 중 고른다면?", "options": ["대기업", "중견기업", "스타트업", "공공기관", "창업"]},
       {"type": "scale", "text": "취업 준비가 얼마나 막막하게 느껴지나요?"},
       {"type": "scale", "text": "학교의 진로 지원에 얼마나 만족하나요?"}]},

    {"title": "[예시] 대학생 연애, 요즘은 어때요?", "category": "relation", "target": 100,
     "desc": "연애 경험이 없어도 생각을 골라 주세요.",
     "questions": [
       {"type": "single", "text": "지금 연애 중인가요?", "options": ["연애 중", "썸 타는 중", "솔로", "말하고 싶지 않아요"]},
       {"type": "single", "text": "연락 빈도는 어느 정도가 좋아요?", "options": ["틈날 때마다", "하루 몇 번", "하루 한 번", "필요할 때만"]},
       {"type": "single", "text": "데이트 비용은 어떻게 나누는 게 좋아요?", "options": ["반반", "번갈아 내기", "데이트 통장", "여유 있는 사람이"]},
       {"type": "single", "text": "CC(캠퍼스 커플), 어떻게 생각해요?", "options": ["좋아요", "괜찮지만 조심", "별로예요", "상관없어요"]},
       {"type": "multi", "text": "주로 어디서 만나요(만나고 싶어요)?", "options": ["카페", "맛집", "전시·공연", "집", "산책"]},
       {"type": "scale", "text": "연애가 학업에 영향을 준다고 생각하나요?"}]},

    {"title": "[예시] 요즘 즐겨 보는 콘텐츠", "category": "taste", "target": 120,
     "desc": "최근 한 달 기준으로 답해 주세요.",
     "questions": [
       {"type": "multi", "text": "자주 보는 콘텐츠를 모두 골라 주세요", "options": ["유튜브", "숏폼(릴스·쇼츠)", "드라마", "예능", "웹툰", "게임 방송"]},
       {"type": "single", "text": "하루에 영상을 보는 시간은?", "options": ["1시간 미만", "1~2시간", "2~4시간", "4시간 이상"]},
       {"type": "single", "text": "가장 많이 쓰는 OTT는?", "options": ["넷플릭스", "티빙", "쿠팡플레이", "디즈니+", "안 써요"]},
       {"type": "single", "text": "콘텐츠는 주로 언제 보나요?", "options": ["등하교 중", "밥 먹을 때", "자기 전", "공강 시간"]},
       {"type": "scale", "text": "숏폼을 보는 시간이 너무 많다고 느끼나요?"}]},

    {"title": "[예시] 캠퍼스 카페 이용 습관", "category": "consume", "target": 100,
     "desc": "교내·학교 앞 카페 이용을 알아봐요. 마지막에 바라는 점을 적어 주세요.",
     "questions": [
       {"type": "single", "text": "일주일에 카페를 몇 번 가나요?", "options": ["거의 안 가요", "1~2번", "3~5번", "매일"]},
       {"type": "single", "text": "주로 마시는 음료는?", "options": ["아메리카노", "라떼", "에이드·티", "스무디", "기타"]},
       {"type": "single", "text": "한 번에 쓰는 금액은?", "options": ["3천 원 미만", "3~5천 원", "5~7천 원", "7천 원 이상"]},
       {"type": "multi", "text": "카페를 고르는 이유를 모두 골라 주세요", "options": ["가격", "맛", "자리·콘센트", "가까움", "분위기"]},
       {"type": "single", "text": "카페에서 주로 하는 일은?", "options": ["공부·과제", "친구와 수다", "혼자 쉬기", "테이크아웃만"]},
       {"type": "single", "text": "개인 텀블러를 쓰나요?", "options": ["항상", "가끔", "거의 안 써요"]},
       {"type": "scale", "text": "학교 근처 카페 가격에 얼마나 만족하나요?"},
       {"type": "scale", "text": "교내 카페 좌석이 충분하다고 느끼나요?"},
       {"type": "text", "text": "학교 카페에 바라는 점을 자유롭게 적어 주세요"}]},

    {"title": "[예시] 대학생의 사회 이슈 관심도", "category": "society", "target": 100,
     "desc": "뉴스를 얼마나, 어떻게 보는지 알아봐요. 20문항 정도예요.",
     "questions": [
       {"type": "single", "text": "뉴스를 얼마나 자주 보나요?", "options": ["매일", "주 몇 번", "가끔", "거의 안 봐요"]},
       {"type": "multi", "text": "뉴스를 주로 어디서 보나요?", "options": ["포털", "유튜브", "SNS", "커뮤니티", "신문·방송"]},
       {"type": "multi", "text": "관심 있는 분야를 모두 골라 주세요", "options": ["경제", "정치", "사회", "국제", "환경", "IT·과학"]},
       {"type": "scale", "text": "청년 주거 문제에 얼마나 관심 있나요?"},
       {"type": "scale", "text": "청년 일자리 문제에 얼마나 관심 있나요?"},
       {"type": "scale", "text": "기후·환경 문제에 얼마나 관심 있나요?"},
       {"type": "scale", "text": "저출생 문제에 얼마나 관심 있나요?"},
       {"type": "scale", "text": "교육·입시 문제에 얼마나 관심 있나요?"},
       {"type": "scale", "text": "젠더 이슈에 얼마나 관심 있나요?"},
       {"type": "single", "text": "지난 선거에 투표했나요?", "options": ["했어요", "못 했어요", "안 했어요", "투표권이 없었어요"]},
       {"type": "single", "text": "정치 이야기를 친구와 하나요?", "options": ["자주", "가끔", "거의 안 해요", "피하는 편"]},
       {"type": "single", "text": "가짜 뉴스를 구별할 자신이 있나요?", "options": ["자신 있어요", "대체로", "잘 모르겠어요", "자신 없어요"]},
       {"type": "single", "text": "사회 문제로 서명·기부를 해 본 적 있나요?", "options": ["자주", "몇 번", "한 번", "없어요"]},
       {"type": "single", "text": "기사를 끝까지 읽는 편인가요?", "options": ["대부분", "가끔", "제목만", "거의 안 봐요"]},
       {"type": "single", "text": "댓글을 보고 생각이 바뀐 적 있나요?", "options": ["자주", "가끔", "거의 없어요"]},
       {"type": "scale", "text": "사회 문제가 내 삶에 영향을 준다고 느끼나요?"},
       {"type": "scale", "text": "청년의 목소리가 정책에 반영된다고 느끼나요?"},
       {"type": "single", "text": "대학이 사회 문제를 다루는 강의를 늘려야 할까요?", "options": ["그렇다", "보통", "아니다"]},
       {"type": "text", "text": "요즘 가장 관심 있는 사회 이슈 하나를 적어 주세요"},
       {"type": "text", "text": "그 이슈에 대한 생각을 짧게 적어 주세요"}]},

    {"title": "[예시] 졸업 후 진로 고민 심층 조사", "category": "career", "target": 50,
     "desc": "주관식이 많은 긴 설문이에요(약 8분). 솔직하게 적어 주시면 진로 프로그램 기획에 써요.",
     "questions": [
       {"type": "single", "text": "지금 몇 학년인가요?", "options": ["1학년", "2학년", "3학년", "4학년 이상", "대학원"]},
       {"type": "single", "text": "졸업 후 계획은?", "options": ["취업", "대학원", "창업", "공무원·고시", "아직 모름"]},
       {"type": "scale", "text": "진로가 얼마나 정해졌나요?"},
       {"type": "scale", "text": "진로 고민 때문에 불안한 정도는?"},
       {"type": "single", "text": "진로 상담을 받아 본 적 있나요?", "options": ["학교 상담센터", "교수님", "외부 프로그램", "없어요"]},
       {"type": "multi", "text": "진로 정보를 어디서 얻나요?", "options": ["선배", "커뮤니티", "유튜브", "학교 프로그램", "가족"]},
       {"type": "text", "text": "지금 가장 큰 진로 고민은 무엇인가요?"},
       {"type": "text", "text": "그 고민이 생긴 계기를 적어 주세요"},
       {"type": "text", "text": "지금까지 해 본 준비(활동·자격증 등)를 적어 주세요"},
       {"type": "text", "text": "준비하면서 가장 어려웠던 점은?"},
       {"type": "text", "text": "학교가 도와줬으면 하는 것은?"},
       {"type": "text", "text": "5년 뒤 나는 어떤 모습이면 좋겠나요?"},
       {"type": "text", "text": "진로를 정할 때 가장 중요하게 보는 가치는?"},
       {"type": "text", "text": "비슷한 고민을 하는 친구에게 한마디 한다면?"},
       {"type": "text", "text": "도움이 됐던 경험·사람이 있다면 적어 주세요"},
       {"type": "text", "text": "이 설문에 대한 의견이 있다면 자유롭게 적어 주세요"}]}
  ]$spec$;
  v_s jsonb;
  v_i integer := 0;
  v_id bigint;
  v_log text := E'\n';
begin
  if v_orgs is null then
    raise exception '승인된 단체 계정이 필요해요';
  end if;

  for v_s in select * from jsonb_array_elements(v_spec) loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_orgs[1 + v_i % cardinality(v_orgs)], 'role', 'authenticated')::text, true);
    v_id := public.create_survey(gen_random_uuid(), (v_cat ->> (v_s ->> 'category'))::bigint,
      v_s ->> 'title', v_s ->> 'desc', 'all', (v_s ->> 'target')::integer, 10, v_s -> 'questions');
    v_log := v_log || format('%s · %s분 · 응답 %sP',
      v_s ->> 'title',
      (select est_minutes from public.surveys where id = v_id),
      (select reward_points from public.surveys where id = v_id)) || E'\n';
    v_i := v_i + 1;
  end loop;

  raise notice '만든 설문 %개:%', v_i, v_log;
end;
$$;

-- 확인: 진행 중인 [예시] 설문
select title, est_minutes as 예상_분, reward_points as 보상, target_responses as 목표, closes_at as 마감
  from public.surveys where title like '[예시]%' and status = 'open' order by created_at;
