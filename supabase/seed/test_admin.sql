-- 운영자 화면(20261031000003_admin) 확인용 테스트 (2026-10-31)
-- 마이그레이션 적용 후 SQL Editor에서 Run.
-- 마지막에 일부러 오류를 내서 테스트로 바꾼 내용은 전부 취소된다 (DB에 남지 않음).
-- 운영자 계정이 아직 없어도 되게, 블록 안에서만 단체 테스터를 운영자(admin)로 바꿔서 확인한다.
-- 괄호 안이 기대값

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' and approval_status = 'approved' order by created_at limit 1);
  v_category bigint := (select id from public.survey_categories where key = 'life');
  v_one jsonb := '[{"type": "single", "text": "하나", "options": ["가", "나"]}]';
  v_s1 bigint;
  v_s2 bigint;
  v_fb bigint;
  v_n integer;
  v_list jsonb;
  v_log text := E'\n';
begin
  if v_student is null or v_org is null then
    raise exception '학생 테스터와 승인된 단체 테스터가 필요해요';
  end if;
  update public.point_rules set value = 1 where key = 'report_hide_count';
  update public.profiles set role = 'admin' where id = v_org;

  -- 준비: 운영자(단체 테스터)가 설문 2개 등록 → 학생이 둘 다 신고 (기준 1명이라 바로 숨김)
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  v_s1 := public.create_survey(gen_random_uuid(), v_category, '운영 테스트 1', null, 'all', 10, 3, v_one);
  v_s2 := public.create_survey(gen_random_uuid(), v_category, '운영 테스트 2', null, 'all', 10, 3, v_one);

  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  perform public.report_survey(v_s1, 'spam', '광고 같아요');
  perform public.report_survey(v_s2, 'abuse');
  v_fb := public.send_feedback('bug', '운영 테스트 의견', '마이 탭');

  -- 1. 학생은 운영자 함수를 못 씀
  v_log := v_log || format('1. 학생 is_admin: %s(false)', public.is_admin()) || E'\n';
  begin
    perform public.admin_get_counts();
    v_log := v_log || E'1-1. 학생 대기 건수 보기: ❌ 됨\n';
  exception when others then
    v_log := v_log || '1-1. 학생 대기 건수 보기: ' || sqlerrm || E'(not_admin)\n';
  end;
  begin
    perform public.admin_resolve_report('survey', v_s1, 'keep');
    v_log := v_log || E'1-2. 학생 신고 처리: ❌ 됨\n';
  exception when others then
    v_log := v_log || '1-2. 학생 신고 처리: ' || sqlerrm || E'(not_admin)\n';
  end;
  begin
    perform public.admin_decide_org(v_org, false, '테스트');
    v_log := v_log || E'1-3. 학생 단체 거절: ❌ 됨\n';
  exception when others then
    v_log := v_log || '1-3. 학생 단체 거절: ' || sqlerrm || E'(not_admin)\n';
  end;

  -- 이제 운영자로
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  v_log := v_log || format('2. 운영자 is_admin: %s(true)', public.is_admin()) || E'\n';
  v_log := v_log || format('3. 대기 건수: %s(reports 2 이상, feedback 1 이상)', public.admin_get_counts()) || E'\n';

  -- 4. 신고 목록: 대상별로 묶이고 신고한 사람은 없음
  v_list := public.admin_get_reports();
  select e into v_list from jsonb_array_elements(v_list) e where (e->>'id')::bigint = v_s1 and e->>'type' = 'survey';
  v_log := v_log || format('4. 설문1 신고: 건수 %s(1) · 상태 %s(hidden) · 제목 %s · 신고자 정보 %s(없음)',
    v_list->>'count', v_list->>'moderation', v_list->>'title',
    case when v_list::text like '%' || v_student::text || '%' then '❌ 있음' else '없음' end) || E'\n';

  -- 5. 문제없음 → 다시 보이고 신고 닫힘. 두 번 누르면 0건
  v_n := public.admin_resolve_report('survey', v_s1, 'keep');
  v_log := v_log || format('5. 문제없음: 닫은 신고 %s(1) · 설문 %s(visible) · 신고 %s(kept)', v_n,
    (select moderation from public.surveys where id = v_s1),
    (select status from public.reports where target_id = v_s1 and target_type = 'survey')) || E'\n';
  v_log := v_log || format('5-1. 다시 누름: 닫은 신고 %s(0)', public.admin_resolve_report('survey', v_s1, 'keep')) || E'\n';

  -- 6. 삭제 → 내용 내림
  v_n := public.admin_resolve_report('survey', v_s2, 'remove');
  v_log := v_log || format('6. 삭제: 닫은 신고 %s(1) · 설문 %s(removed) · 신고 %s(removed)', v_n,
    (select moderation from public.surveys where id = v_s2),
    (select status from public.reports where target_id = v_s2 and target_type = 'survey')) || E'\n';

  -- 7. 틀린 요청
  begin
    perform public.admin_resolve_report('survey', v_s2, 'ban');
    v_log := v_log || E'7. 틀린 처리: ❌ 됨\n';
  exception when others then
    v_log := v_log || '7. 틀린 처리: ' || sqlerrm || E'(invalid_request)\n';
  end;

  -- 8. 의견: 목록에 보낸 사람 없음 → 빈 답변 거절 → 답변
  v_list := public.admin_get_feedback();
  v_log := v_log || format('8. 의견 목록에 보낸 사람 정보: %s(없음)',
    case when v_list::text like '%' || v_student::text || '%' then '❌ 있음' else '없음' end) || E'\n';
  begin
    perform public.admin_reply_feedback(v_fb, '   ', 'answered');
    v_log := v_log || E'8-1. 빈 답변: ❌ 됨\n';
  exception when others then
    v_log := v_log || '8-1. 빈 답변: ' || sqlerrm || E'(reply_empty)\n';
  end;
  perform public.admin_reply_feedback(v_fb, '고쳤어요, 고마워요!', 'done');
  v_log := v_log || format('8-2. 답변 후: %s(done) · %s', (select status from public.feedback where id = v_fb),
    (select reply from public.feedback where id = v_fb)) || E'\n';

  -- 9. 단체 승인: 단체 테스터를 잠시 대기로 돌려 확인
  update public.profiles set approval_status = 'pending' where id = v_org;
  v_list := public.admin_get_pending_orgs();
  v_log := v_log || format('9. 대기 단체 수: %s(1 이상) · 메일 있음: %s(true)', jsonb_array_length(v_list),
    (select e ? 'email' from jsonb_array_elements(v_list) e where (e->>'id')::uuid = v_org)) || E'\n';
  begin
    perform public.admin_decide_org(v_org, false, '');
    v_log := v_log || E'9-1. 사유 없이 거절: ❌ 됨\n';
  exception when others then
    v_log := v_log || '9-1. 사유 없이 거절: ' || sqlerrm || E'(reject_reason_required)\n';
  end;
  perform public.admin_decide_org(v_org, false, '증빙 링크가 열리지 않아요');
  v_log := v_log || format('9-2. 거절: %s(rejected) · 사유 %s', (select approval_status from public.profiles where id = v_org),
    (select reject_reason from public.organizations where id = v_org)) || E'\n';
  begin
    perform public.admin_decide_org(v_org, true);
    v_log := v_log || E'9-3. 대기 아닌 단체 처리: ❌ 됨\n';
  exception when others then
    v_log := v_log || '9-3. 대기 아닌 단체 처리: ' || sqlerrm || E'(org_not_pending)\n';
  end;
  update public.profiles set approval_status = 'pending' where id = v_org;
  perform public.admin_decide_org(v_org, true);
  v_log := v_log || format('9-4. 승인: %s(approved) · 사유 %s(null)', (select approval_status from public.profiles where id = v_org),
    coalesce((select reject_reason from public.organizations where id = v_org), 'null')) || E'\n';

  -- 10. 앱이 표를 직접 고칠 수는 없음 (운영자라도 RLS 그대로)
  begin
    set local role authenticated;
    update public.reports set status = 'pending' where target_id = v_s2;
    get diagnostics v_n = row_count;
    reset role;
    v_log := v_log || format('10. 운영자가 reports 표 직접 수정: %s줄(0 또는 권한 없음)', v_n) || E'\n';
  exception when others then
    reset role;
    v_log := v_log || '10. 운영자가 reports 표 직접 수정: ' || sqlerrm || E'(권한 없음 = 정상)\n';
  end;

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
