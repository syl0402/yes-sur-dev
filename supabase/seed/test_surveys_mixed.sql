-- 4종 문항 테스트용 설문 5개 (2026-10-30)
-- 작성자 = 승인된 단체 테스터. 앱의 [등록]과 같은 create_survey로 만든다 (확인용 문항 자동, 단체라 비용 0)
-- SQL Editor에서 Run. 실행할 때마다 5개씩 새로 생긴다.
-- 지울 때: delete from public.surveys where title like '[테스트]%';

do $$
declare
  v_org uuid := (select id from public.profiles where account_type = 'org' and approval_status = 'approved' limit 1);
begin
  if v_org is null then
    raise exception '승인된 단체 테스터가 필요해요';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);

  -- ① 6문항 (4종 모두 + 확인용 문항 자동) → 약 2분, 보상 30P
  perform public.create_survey(gen_random_uuid(),
    (select id from public.survey_categories where key = 'life'),
    '[테스트] 대학생 아침 식사 습관', '아침을 먹는지, 먹는다면 무엇을 먹는지 알려 주세요.', 'all', 30, 7,
    '[
      {"type": "single", "text": "평일에 아침을 먹나요?", "options": ["거의 매일", "가끔", "거의 안 먹어요"]},
      {"type": "multi",  "text": "아침으로 주로 먹는 것을 모두 골라 주세요", "options": ["밥", "빵", "시리얼", "과일", "커피만"]},
      {"type": "scale",  "text": "지금 아침 식사 습관에 만족하나요?"},
      {"type": "text",   "text": "아침을 거르는 가장 큰 이유는 무엇인가요?"},
      {"type": "single", "text": "학교에서 아침을 판다면 사 먹을 건가요?", "options": ["네", "아니요", "가격에 따라"]},
      {"type": "scale",  "text": "아침을 먹으면 수업 집중이 잘 된다고 느끼나요?"}
    ]');

  -- ② 척도 3 + 주관식 1 → 약 2분, 보상 30P
  perform public.create_survey(gen_random_uuid(),
    (select id from public.survey_categories where key = 'community'),
    '[테스트] 동아리 활동 만족도', null, 'all', 30, 7,
    '[
      {"type": "scale", "text": "동아리 활동 전반에 만족하나요?"},
      {"type": "scale", "text": "동아리 사람들과 잘 지내고 있나요?"},
      {"type": "scale", "text": "동아리 활동이 공부에 방해가 되나요?"},
      {"type": "text",  "text": "동아리에 바라는 점을 적어 주세요"}
    ]');

  -- ③ 1문항 → 보상 10P
  perform public.create_survey(gen_random_uuid(),
    (select id from public.survey_categories where key = 'taste'),
    '[테스트] 한 줄 취향: 민트초코', '1문항짜리 짧은 설문이에요.', 'all', 30, 3,
    '[
      {"type": "single", "text": "민트초코는?", "options": ["좋아요", "싫어요"]}
    ]');

  -- ④ 복수 + 단일 + 주관식 → 약 2분, 보상 30P
  perform public.create_survey(gen_random_uuid(),
    (select id from public.survey_categories where key = 'consume'),
    '[테스트] 시험 기간 카페 이용', null, 'all', 30, 7,
    '[
      {"type": "multi",  "text": "시험 기간에 공부하는 곳을 모두 골라 주세요", "options": ["도서관", "학교 카페", "동네 카페", "집", "스터디카페"]},
      {"type": "single", "text": "카페에서 하루 평균 쓰는 돈은?", "options": ["5천 원 미만", "5천~1만 원", "1만 원 이상"]},
      {"type": "text",   "text": "공부하기 좋은 카페의 조건은 무엇인가요?"}
    ]');

  -- ⑤ 7문항 (확인용 문항 자동) → 약 2분, 보상 30P
  perform public.create_survey(gen_random_uuid(),
    (select id from public.survey_categories where key = 'study'),
    '[테스트] 캠퍼스 앱 사용 실태', '학교생활에 쓰는 앱을 조사해요.', 'all', 30, 7,
    '[
      {"type": "single", "text": "학교 공식 앱을 쓰나요?", "options": ["자주", "가끔", "안 써요"]},
      {"type": "multi",  "text": "학교생활에 쓰는 앱을 모두 골라 주세요", "options": ["에브리타임", "학교 공식 앱", "카카오톡", "노션", "구글 클래스룸"]},
      {"type": "scale",  "text": "학교 공식 앱에 만족하나요?"},
      {"type": "scale",  "text": "앱 하나로 학교생활을 다 하고 싶나요?"},
      {"type": "text",   "text": "학교 앱에 꼭 있었으면 하는 기능은?"},
      {"type": "single", "text": "새 학교 앱이 나오면 써 볼 건가요?", "options": ["네", "아니요"]},
      {"type": "multi",  "text": "앱에서 가장 불편한 점을 모두 골라 주세요", "options": ["느림", "로그인", "알림이 많음", "디자인"]}
    ]');
end;
$$;

-- 만든 설문 확인 (이 결과가 화면에 보인다)
select id, title, question_count, est_minutes, reward_points
  from public.surveys
 where title like '[테스트]%'
 order by id desc
 limit 5;
