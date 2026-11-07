-- 보상 연락처(20261107000006) 확인용 테스트 (2026-11-07)
-- 마이그레이션 적용 후 SQL Editor에서 Run. 마지막에 일부러 오류를 내서 바꾼 내용은 모두 취소된다. 괄호 안이 기대값
-- 다른 사람이 응답을 마친(confirmed) 설문이 하나 있어야 한다

do $$
declare
  v_survey bigint;
  v_owner uuid;
  v_resp uuid;      -- 응답을 마친 사람
  v_stranger uuid;  -- 응답 안 한 사람
  v_list text[];
  v_log text := E'\n';
  claims_owner text;
  claims_resp text;
  claims_stranger text;
begin
  select r.survey_id, s.owner_id, r.user_id into v_survey, v_owner, v_resp
    from public.responses r join public.surveys s on s.id = r.survey_id
   where r.status = 'confirmed' and r.user_id is distinct from s.owner_id
   order by r.submitted_at desc limit 1;
  v_stranger := (select p.id from public.profiles p
                  where p.id is distinct from v_owner
                    and not exists (select 1 from public.responses r where r.survey_id = v_survey and r.user_id = p.id)
                  order by p.created_at limit 1);
  if v_survey is null or v_stranger is null then
    raise exception '다른 사람이 응답한 설문 1개와, 그 설문에 응답 안 한 계정 1개가 필요해요';
  end if;
  claims_owner := json_build_object('sub', v_owner, 'role', 'authenticated')::text;
  claims_resp := json_build_object('sub', v_resp, 'role', 'authenticated')::text;
  claims_stranger := json_build_object('sub', v_stranger, 'role', 'authenticated')::text;

  -- 보상 안내 전: 응답자가 남기면 거부
  perform set_config('request.jwt.claims', claims_resp, true);
  begin
    perform public.submit_reward_contact(v_survey, '010-1234-5678', true);
    v_log := v_log || '보상 안 켠 설문: 통과 (X 문제)' || E'\n';
  exception when others then
    v_log := v_log || format('보상 안 켠 설문: %s (not_reward_survey)', sqlerrm) || E'\n';
  end;

  -- 남이 보상 켜기 거부 → 작성자가 켜기
  begin
    perform public.set_survey_reward(v_survey, '추첨 3명 기프티콘');
    v_log := v_log || '남이 보상 켜기: 통과 (X 문제)' || E'\n';
  exception when others then
    v_log := v_log || format('남이 보상 켜기: %s (not_survey_owner)', sqlerrm) || E'\n';
  end;
  perform set_config('request.jwt.claims', claims_owner, true);
  perform public.set_survey_reward(v_survey, '추첨 3명 기프티콘 · 문의 https://open.kakao.com/o/test');
  v_log := v_log || format('작성자가 보상 켜기: 안내 %s자', (select char_length(note) from public.survey_rewards where survey_id = v_survey)) || E'\n';

  -- 응답자: 동의 없음 거부 · 형식 오류 거부 · 정상 두 번 → 1건
  perform set_config('request.jwt.claims', claims_resp, true);
  begin
    perform public.submit_reward_contact(v_survey, '010-1234-5678', false);
    v_log := v_log || '동의 없음: 통과 (X 문제)' || E'\n';
  exception when others then
    v_log := v_log || format('동의 없음: %s (consent_required)', sqlerrm) || E'\n';
  end;
  begin
    perform public.submit_reward_contact(v_survey, '12345', true);
    v_log := v_log || '형식 오류: 통과 (X 문제)' || E'\n';
  exception when others then
    v_log := v_log || format('형식 오류: %s (invalid_phone)', sqlerrm) || E'\n';
  end;
  perform public.submit_reward_contact(v_survey, '010-1234-5678', true);
  perform public.submit_reward_contact(v_survey, '01098765432', true);
  v_log := v_log || format('두 번 남긴 뒤 %s건 (1) · 저장된 번호 %s (01098765432)',
    (select count(*) from public.reward_contacts where survey_id = v_survey and user_id = v_resp),
    (select phone from public.reward_contacts where survey_id = v_survey and user_id = v_resp)) || E'\n';
  v_log := v_log || format('응답자 남김 확인 %s (true)', public.has_my_reward_contact(v_survey)) || E'\n';

  -- 응답자가 목록 보기 거부 (작성자 아님)
  begin
    perform public.get_reward_contacts(v_survey);
    v_log := v_log || '응답자가 목록 보기: 통과 (X 문제)' || E'\n';
  exception when others then
    v_log := v_log || format('응답자가 목록 보기: %s (not_survey_owner)', sqlerrm) || E'\n';
  end;

  -- 응답 안 한 사람 거부
  perform set_config('request.jwt.claims', claims_stranger, true);
  begin
    perform public.submit_reward_contact(v_survey, '010-1111-2222', true);
    v_log := v_log || '응답 안 한 사람: 통과 (X 문제)' || E'\n';
  exception when others then
    v_log := v_log || format('응답 안 한 사람: %s (not_responded)', sqlerrm) || E'\n';
  end;
  begin
    perform public.clear_reward_contacts(v_survey);
    v_log := v_log || '남이 지우기: 통과 (X 문제)' || E'\n';
  exception when others then
    v_log := v_log || format('남이 지우기: %s (not_survey_owner)', sqlerrm) || E'\n';
  end;

  -- 작성자: 목록 보기 → 모두 지우기
  perform set_config('request.jwt.claims', claims_owner, true);
  v_list := public.get_reward_contacts(v_survey);
  v_log := v_log || format('작성자 목록 %s (1개 번호만)', v_list) || E'\n';
  perform public.clear_reward_contacts(v_survey);
  v_log := v_log || format('지운 뒤 %s건 (0)', (select count(*) from public.reward_contacts where survey_id = v_survey)) || E'\n';

  -- 자동 삭제: 31일 전 것으로 만들고 지우기 함수 실행
  insert into public.reward_contacts (survey_id, user_id, phone, consented_at, created_at)
  values (v_survey, v_resp, '01011112222', now(), now() - interval '31 days');
  perform public.purge_expired_personal_data();
  v_log := v_log || format('31일 지난 연락처 자동 삭제 뒤 %s건 (0)',
    (select count(*) from public.reward_contacts where survey_id = v_survey)) || E'\n';

  raise exception '테스트 결과:%', v_log;
end;
$$;
