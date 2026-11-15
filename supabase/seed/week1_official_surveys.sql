-- 1주차 공식 설문 4개 예약 올리기 (2026-11-15 · 원문: 기획팀 "설문 (카테고리별 8개)")
-- 운영자 계정(yessur.team@gmail.com, 단체 → 테스트 기간 등록 무료)으로 정한 시각에 서버가 자동으로 올린다 (pg_cron)
--   · 11/16(월) 03:00  커피 · 텀블러 · 첫 직장  → 3일차 "설문 1개 응답" 미션용, 11/23 03:00 마감 (11/15 밤 사용자 요청: 3시간 뒤)
--   · 11/18(수) 12:00  데이트 비용                → 11/25 마감
-- 기존 공식 설문과 겹치는 4개(AI 공부법·OTT 구독·한 달 생활비·옛썰에서 보고 싶은 설문)는 뺐다 → 정식 출시 콘텐츠로
-- 첫 직장은 기존 "인턴십 준비 실태"와 겹치는 "인턴 경험" 문항을 뺐다
-- 목표 100명 · 7일 마감 · 결과 공개 (기존 공식 설문과 같음). 확인 문항은 서버가 규칙대로 넣는다
--
-- ⚠️ 한 번만 실행. 다시 실행하면 같은 이름의 예약을 덮어써서 중복은 생기지 않는다 (이미 올라간 뒤엔 다시 실행하지 말 것)
-- 각 예약은 설문을 올린 뒤 스스로 지워진다. 맨 아래 확인 쿼리로 결과를 본다

-- 11/16(월) 03:00 한국 = 11/15 18:00 UTC
select cron.schedule('official-w1-1116', '0 18 15 11 *', $job$
do $$
declare
  v_admin uuid := (select p.id from public.profiles p join auth.users u on u.id = p.id
                    where u.email = 'yessur.team@gmail.com' and p.role = 'admin');
  v_id bigint;
begin
  if v_admin is null then
    raise exception '운영자 계정(yessur.team@gmail.com)을 찾지 못했어요';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  -- 커피
  v_id := public.create_survey(gen_random_uuid(),
    (select id from public.survey_categories where key = 'consume'),
    '저가 커피 vs 프리미엄 커피, 언제 뭐를 고를까?',
    '같은 커피인데 어떤 날은 1,500원, 어떤 날은 5,000원. 무엇이 선택을 바꾸는지 궁금해요.',
    'all', 100, 7,
    '[{"type": "single", "text": "한 주에 사 마시는 커피·음료는?", "options": ["거의 안 마신다", "1~2잔", "3~5잔", "6잔 이상"]},
      {"type": "single", "text": "최근 일주일, 가장 많이 산 곳은?", "options": ["저가 커피 브랜드", "대형 프랜차이즈", "개인 카페", "편의점", "학교 안 카페"]},
      {"type": "multi", "text": "저가 커피를 고르는 상황은?", "options": ["테이크아웃", "혼자일 때", "수업 사이 짧은 시간", "맛 차이를 못 느낄 때", "해당 없음"]},
      {"type": "multi", "text": "더 비싼 카페를 고르는 상황은?", "options": ["오래 앉아 공부할 때", "친구·데이트", "기프티콘이 있을 때", "시즌 메뉴", "해당 없음"]},
      {"type": "single", "text": "테이크아웃 아메리카노 적정 가격은?", "options": ["1,500원 이하", "2,000원대", "3,000원대", "4,000원 이상"]},
      {"type": "scale", "text": "앱 적립·할인이 카페 선택에 주는 영향은?"}]');
  insert into public.survey_tags (survey_id, tag_id)
    select v_id, id from public.tags where name in ('음식·카페') on conflict do nothing;

  -- 텀블러
  v_id := public.create_survey(gen_random_uuid(),
    (select id from public.survey_categories where key = 'society'),
    '텀블러, 실제로 들고 다니나요?',
    '환경에 좋다는 건 알지만, 실제로는? 무엇이 행동을 바꿀 수 있는지 물어봐요.',
    'all', 100, 7,
    '[{"type": "single", "text": "최근 한 달, 카페에서 텀블러를 몇 번 썼나요?", "options": ["안 썼다", "1~3번", "4~10번", "거의 매번"]},
      {"type": "single", "text": "안 쓰게 되는 가장 큰 이유는?", "options": ["들고 다니기 무거움", "씻기 귀찮음", "깜빡함", "할인이 작음", "매번 쓴다"]},
      {"type": "single", "text": "텀블러 할인이 얼마면 꼭 챙기겠어요?", "options": ["300원", "500원", "1,000원", "할인과 상관없다"]},
      {"type": "single", "text": "친환경 제품이라면 더 낼 수 있는 금액은?", "options": ["더 안 낸다", "5% 이내", "10% 이내", "10% 넘게도"]},
      {"type": "scale", "text": "환경을 고려해 소비를 바꾼 적이 있나요?"}]');
  insert into public.survey_tags (survey_id, tag_id)
    select v_id, id from public.tags where name in ('음식·카페', '트렌드·밈') on conflict do nothing;

  -- 첫 직장 ("인턴 경험" 문항은 기존 인턴십 설문과 겹쳐서 뺌)
  v_id := public.create_survey(gen_random_uuid(),
    (select id from public.survey_categories where key = 'career'),
    '첫 직장, 진짜 뭐 보고 고를 거예요?',
    '연봉, 워라밸, 성장 중 하나만 고르라면? 다른 대학생들의 기준과 비교해 보세요.',
    'all', 100, 7,
    '[{"type": "single", "text": "지금 취업 준비 상황은?", "options": ["아직 생각 안 함", "방향 탐색 중", "스펙 준비 중", "지원 중", "진학·창업 등 다른 길"]},
      {"type": "single", "text": "첫 직장을 고를 때 1순위는?", "options": ["연봉", "워라밸", "성장·커리어", "안정성", "위치·통근", "회사 이름값", "조직문화"]},
      {"type": "single", "text": "기대하는 첫 연봉은?", "options": ["3천만 원 미만", "3천~3천5백", "3천5백~4천", "4천~5천", "5천만 원 이상", "모르겠다"]},
      {"type": "multi", "text": "취업 정보는 어디서 얻나요?", "options": ["채용 플랫폼", "기업 리뷰 앱", "유튜브", "선배·지인", "학교 취업센터", "인스타·커뮤니티", "아직 안 찾아봄"]},
      {"type": "single", "text": "취업 준비에서 가장 막막한 것은?", "options": ["뭐를 하고 싶은지", "경험 쌓을 기회", "자소서·면접", "정보 부족", "돈·시간", "딱히 없음"]}]');
  insert into public.survey_tags (survey_id, tag_id)
    select v_id, id from public.tags where name in ('대외활동·인턴') on conflict do nothing;

  perform cron.unschedule('official-w1-1116');
end;
$$;
$job$);

-- 11/18(수) 12:00 한국 = 11/18 03:00 UTC
select cron.schedule('official-w1-1118', '0 3 18 11 *', $job$
do $$
declare
  v_admin uuid := (select p.id from public.profiles p join auth.users u on u.id = p.id
                    where u.email = 'yessur.team@gmail.com' and p.role = 'admin');
  v_id bigint;
begin
  if v_admin is null then
    raise exception '운영자 계정(yessur.team@gmail.com)을 찾지 못했어요';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  -- 데이트 비용 (민감한 주제라 모든 문항에 "해당 없음")
  v_id := public.create_survey(gen_random_uuid(),
    (select id from public.survey_categories where key = 'relation'),
    '대학생 데이트, 비용은 어떻게 나눠요?',
    '반반? 번갈아? 모임통장? 다른 커플들은 어떻게 하는지 궁금했다면.',
    'all', 100, 7,
    '[{"type": "single", "text": "연애 상황은?", "options": ["지금 연애 중", "예전에 해 봤다", "없다", "답하고 싶지 않음"]},
      {"type": "single", "text": "데이트 한 번 평균 비용(두 사람 합계)은?", "options": ["3만 원 미만", "3~5만", "5~10만", "10만 원 이상", "해당 없음"]},
      {"type": "single", "text": "비용은 어떻게 내나요?", "options": ["반반", "번갈아", "모임통장", "한쪽이 더 많이", "해당 없음"]},
      {"type": "multi", "text": "주로 가는 곳은?", "options": ["맛집·카페", "영화·전시", "집·자취방", "야외·산책", "놀거리(방탈출·볼링 등)", "해당 없음"]},
      {"type": "single", "text": "데이트에서 가장 부담되는 것은?", "options": ["비용", "장소 고르기", "시간 맞추기", "특별한 날 선물", "딱히 없음"]}]');
  insert into public.survey_tags (survey_id, tag_id)
    select v_id, id from public.tags where name in ('썸·연애') on conflict do nothing;

  perform cron.unschedule('official-w1-1118');
end;
$$;
$job$);

-- 확인 ① 예약 2개가 보이면 성공 (올린 뒤에는 스스로 지워져서 안 보임)
select jobname, schedule from cron.job where jobname like 'official-w1-%' order by jobname;

-- 확인 ② (11/16 03:00 뒤에 실행) 실행 기록: status가 succeeded면 성공, failed면 return_message를 Claude에게
-- select j.jobname, d.status, d.return_message, d.start_time at time zone 'Asia/Seoul' as 실행
--   from cron.job_run_details d left join cron.job j on j.jobid = d.jobid
--  where d.command like '%official-w1-%' order by d.start_time desc limit 5;
