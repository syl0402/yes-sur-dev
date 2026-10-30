-- 커뮤니티 3단계(20261030000023) 확인용 테스트 (2026-10-30)
-- 마이그레이션 적용 후 SQL Editor에서 Run. 마지막에 일부러 오류를 내서 바꾼 내용은 모두 취소된다.

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' and approval_status = 'approved' order by created_at limit 1);
  v_category bigint := (select id from public.survey_categories where key = 'life');
  v_one jsonb := '[{"type": "single", "text": "하나", "options": ["가", "나"]}]';
  v_survey bigint;
  v_promo bigint;
  v_post bigint;
  v_result jsonb;
  v_log text := E'\n';
begin
  update public.profiles set major_field_id = coalesce(major_field_id, (select id from public.major_fields limit 1))
   where id = v_student;

  -- 단체가 설문 등록
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  v_survey := public.create_survey(gen_random_uuid(), v_category, '홍보 테스트 설문', null, 'all', 10, 3, v_one);

  -- 1. 홍보할 수 있는 설문 목록에 있음 → 홍보글 올리기
  v_log := v_log || format('1. 홍보 가능 목록에 있음: %s(true)',
    public.get_promotable_surveys() @> jsonb_build_array(jsonb_build_object('id', v_survey))) || E'\n';
  v_promo := public.create_promo(v_survey, '3분이면 끝나요! 참여해 주세요', '학식 개선에 쓸게요');

  -- 2. 같은 설문 두 번 홍보 거절, 목록에서도 빠짐
  begin
    perform public.create_promo(v_survey, '한 번 더');
    v_log := v_log || E'2. 두 번 홍보: ❌ 됨\n';
  exception when others then
    v_log := v_log || format('2. 두 번 홍보: %s(promo_exists) · 홍보 가능 목록에 있음 %s(false)', sqlerrm,
      public.get_promotable_surveys() @> jsonb_build_array(jsonb_build_object('id', v_survey))) || E'\n';
  end;

  -- 3. 남의 설문 홍보 거절 (학생이 단체 설문을)
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  begin
    perform public.create_promo(v_survey, '남의 설문');
    v_log := v_log || E'3. 남의 설문 홍보: ❌ 됨\n';
  exception when others then
    v_log := v_log || '3. 남의 설문 홍보: ' || sqlerrm || E'(not_owner)\n';
  end;

  -- 4. 학생 피드: 홍보글에 설문 정보, 투표는 안 됨
  v_result := (select e from jsonb_array_elements(public.get_feed('promo')) e where (e ->> 'id')::bigint = v_promo);
  v_log := v_log || format('4. 피드 홍보글: 설문 "%s"(홍보 테스트 설문) · 남은 자리 %s(10) · 응답함 %s(false)',
    v_result #>> '{survey,title}', v_result #>> '{survey,remaining}', v_result #>> '{survey,answered}') || E'\n';
  begin
    perform public.vote_post(v_promo, 0);
    v_log := v_log || E'   홍보글 투표: ❌ 됨\n';
  exception when others then
    v_log := v_log || '   홍보글 투표: ' || sqlerrm || E'(invalid_choice)\n';
  end;

  -- 5. 설문이 마감되면 피드에서 사라짐
  update public.surveys set status = 'closed' where id = v_survey;
  v_log := v_log || format('5. 마감 후 피드에 있음: %s(false)',
    public.get_feed() @> jsonb_build_array(jsonb_build_object('id', v_promo))) || E'\n';

  -- 6. 계열 대항전: 학생이 글 하나 + 투표 하나 → 내 계열 1위 이상
  v_post := public.create_post('balance', '대항전 테스트', array['가', '나']);
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  v_result := public.get_major_ranking();
  v_log := v_log || format('6. 대항전: 내 계열 %s · 내 순위 %s(숫자) · 1위 %s',
    coalesce(v_result ->> 'my_major', '없음'), coalesce(v_result ->> 'my_rank', 'null'),
    coalesce(v_result #>> '{ranking,0,major}', '없음')) || E'\n';

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
