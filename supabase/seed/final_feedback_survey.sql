-- 최종 피드백 설문 올리기 (2026-11-14 작성 · ⚠️ 11/26(목)에 한 번만 실행)
-- 웰컴 미션 14일차 "최종 피드백 설문 응답하기"는 제목이 "[최종 피드백]"으로 시작하는 설문의 응답을 센다
-- 11/26에 올려 11/27(금) 밤까지 받는다. 너무 일찍 올리면 써 보기 전에 답하게 된다
-- 문항은 기획팀 초안(테스터 안내서 부록 C)을 앱 형식에 맞춤: 0~10점 추천 → 1~5점, 주관식은 일부 선택
-- 운영자(옛썰 공식) 이름으로 올린다. 5문항 이상이라 확인 문항이 자동으로 들어간다

do $$
declare
  v_admin uuid := (select id from public.profiles where role = 'admin' order by created_at limit 1);
  v_id bigint;
begin
  if v_admin is null then
    raise exception '운영자 계정이 없어요';
  end if;
  if exists (select 1 from public.surveys where title like '[최종 피드백]%') then
    raise exception '이미 올렸어요 (두 번 올리지 않게)';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  v_id := public.create_survey(gen_random_uuid(),
    (select id from public.survey_categories where key = 'community'),
    '[최종 피드백] 옛썰 2주 써 보니 어땠어요?',
    '2주 동안 써 본 느낌을 솔직하게 알려 주세요. 정식 출시 전에 고칠 곳을 정하는 데 그대로 써요.',
    'all', 100, 3,
    '[{"type": "scale", "text": "옛썰을 친구에게 추천하고 싶다"},
      {"type": "single", "text": "가장 자주 쓴 탭은?", "options": ["홈", "설문", "커뮤니티", "데이터", "마이"]},
      {"type": "single", "text": "설문이 없어도 앱을 열게 만든 기능이 있었다면?", "options": ["오늘의 질문", "커뮤니티 투표", "월드컵", "웰컴 미션", "없음"]},
      {"type": "scale", "text": "응답 보상 포인트가 소요 시간에 비해 적당했다"},
      {"type": "scale", "text": "결과 화면의 핵심 인사이트가 쓸모 있었다"},
      {"type": "scale", "text": "과제·학회·동아리 설문을 실제로 옛썰에 올릴 것 같다"},
      {"type": "text", "text": "설문을 올리기 망설여지는 이유가 있다면 적어 주세요", "required": false},
      {"type": "text", "text": "대학생 트렌드 리포트가 나온다면 보고 싶은 주제는?", "required": false},
      {"type": "text", "text": "가장 불편했던 점 1가지"},
      {"type": "text", "text": "꼭 추가됐으면 하는 기능 1가지", "required": false}]',
    'public');

  -- 11/27(금) 밤 11시 59분 마감
  update public.surveys set closes_at = '2026-11-27 23:59:00+09' where id = v_id;
end;
$$;

select id, title, closes_at at time zone 'Asia/Seoul' as closes from public.surveys where title like '[최종 피드백]%';
