-- 설문 태그(20261107000001) 확인용 테스트 (2026-11-07)
-- 마이그레이션 적용 후 SQL Editor에서 Run. 마지막에 일부러 오류를 내서 바꾼 내용은 모두 취소된다. 괄호 안이 기대값
-- 설문을 하나 이상 올린 계정이 필요 (아무 설문의 작성자로 테스트)

do $$
declare
  v_survey bigint := (select id from public.surveys order by created_at desc limit 1);
  v_owner uuid := (select owner_id from public.surveys where id = v_survey);
  v_other uuid := (select id from public.profiles where id is distinct from v_owner order by created_at limit 1);
  v_tags bigint[] := array(select id from public.tags where active order by sort_order limit 4);
  v_log text := E'\n';
  v_hub jsonb;
begin
  if v_survey is null or v_other is null then
    raise exception '설문 1개와 계정 2개가 필요해요';
  end if;

  v_log := v_log || format('쓰는 태그 %s개 (20) · 최대 %s개 (3)',
    (select count(*) from public.tags where active), public.point_rule('survey_tag_max')) || E'\n';

  -- 작성자: 3개 붙이기 → 같은 요청 한 번 더 (결과 같아야 함)
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform public.set_survey_tags(v_survey, v_tags[1:3]);
  perform public.set_survey_tags(v_survey, v_tags[1:3]);
  v_log := v_log || format('두 번 붙인 뒤 태그 수 %s (3)',
    (select count(*) from public.survey_tags where survey_id = v_survey)) || E'\n';

  -- 같은 태그 중복은 하나로
  perform public.set_survey_tags(v_survey, array[v_tags[1], v_tags[1]]);
  v_log := v_log || format('같은 태그 두 번 → %s개 (1)',
    (select count(*) from public.survey_tags where survey_id = v_survey)) || E'\n';

  -- 4개는 거부
  begin
    perform public.set_survey_tags(v_survey, v_tags);
    v_log := v_log || '4개: 통과 (X 문제)' || E'\n';
  exception when others then
    v_log := v_log || format('4개: %s (too_many_tags)', sqlerrm) || E'\n';
  end;

  -- 없는 태그 거부
  begin
    perform public.set_survey_tags(v_survey, array[-1::bigint]);
    v_log := v_log || '없는 태그: 통과 (X 문제)' || E'\n';
  exception when others then
    v_log := v_log || format('없는 태그: %s (tag_not_found)', sqlerrm) || E'\n';
  end;

  -- 다른 사람: 남의 설문에 태그 거부
  perform set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  begin
    perform public.set_survey_tags(v_survey, v_tags[1:1]);
    v_log := v_log || '남의 설문: 통과 (X 문제)' || E'\n';
  exception when others then
    v_log := v_log || format('남의 설문: %s (not_survey_owner)', sqlerrm) || E'\n';
  end;

  -- 데이터 탭 목록에 tags 칸이 있는지 (목록에 나오는 설문이 있을 때만)
  v_hub := public.get_hub_list();
  v_log := v_log || format('데이터 탭 첫 줄 tags 칸: %s (배열이면 OK)',
    coalesce(jsonb_typeof(v_hub -> 0 -> 'tags'), '목록 비어 있음')) || E'\n';

  raise exception '테스트 결과:%', v_log;
end;
$$;
