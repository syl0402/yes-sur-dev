-- 앱 안 운영자 화면 (2026-10-31)
--
-- 지금까지 신고 처리·의견 답변·단체 승인은 Supabase Table Editor에서 직접 했다 (docs/DB.md 운영자 절차).
-- 테스트 기간에 폰으로 바로 처리할 수 있게 서버 함수로 옮긴다.
--
-- 권한: 모든 함수가 먼저 is_admin()을 확인한다 (profiles.role = 'admin', 지금은 팀 계정 하나).
--       운영자가 아니면 'not_admin'. 표의 RLS·권한은 그대로 (앱은 표를 직접 못 고치고 이 함수로만 처리)
-- 개인정보: 신고한 사람·의견 보낸 사람은 운영자에게도 보여 주지 않는다. 단체는 확인용으로 가입 메일만 보여 준다
-- 포인트: 건드리지 않는다 (기존 운영 규칙과 같음)

-- =========================================================
-- 1. is_admin: 지금 로그인한 사람이 운영자인가 (앱이 운영 카드를 보여 줄지 정할 때도 쓴다)
-- =========================================================
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

-- =========================================================
-- 2. admin_get_counts: 처리 대기 건수 (신고는 대상 기준)
-- =========================================================
create function public.admin_get_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  return jsonb_build_object(
    'reports', (select count(*) from (select distinct target_type, target_id
                                        from public.reports where status = 'pending') t),
    'feedback', (select count(*) from public.feedback where status = 'pending'),
    'orgs', (select count(*) from public.profiles
              where account_type = 'org' and approval_status = 'pending')
  );
end;
$$;

-- =========================================================
-- 3. admin_get_reports: 확인 전 신고를 대상별로 묶어서 (최근 신고 순)
-- =========================================================
create function public.admin_get_reports()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  with g as (
    select target_type, target_id,
           count(*)::integer as n,
           array_agg(distinct reason) as reasons,
           (array_remove(array_agg(detail order by created_at desc), null))[1:3] as details,
           max(created_at) as last_at
      from public.reports
     where status = 'pending'
     group by target_type, target_id
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'type', g.target_type,
             'id', g.target_id,
             'count', g.n,
             'reasons', to_jsonb(g.reasons),
             'details', to_jsonb(g.details),
             'last_at', g.last_at,
             -- 대상 내용: 설문 = 제목·설명 / 글 = 질문·보기·본문 / 댓글 = 본문 (+ 달린 곳)
             'title', case g.target_type when 'survey' then s.title when 'post' then p.question else c.body end,
             'body', case g.target_type when 'survey' then s.description when 'post' then p.body end,
             'options', case when g.target_type = 'post' then to_jsonb(p.options) end,
             'moderation', coalesce(s.moderation, p.moderation, c.moderation),
             'parent_type', c.target_type,
             'parent_id', c.target_id
           )
           order by g.last_at desc
         ), '[]'::jsonb)
    into v_result
    from g
    left join public.surveys s on g.target_type = 'survey' and s.id = g.target_id
    left join public.posts p on g.target_type = 'post' and p.id = g.target_id
    left join public.comments c on g.target_type = 'comment' and c.id = g.target_id;

  return v_result;
end;
$$;

-- =========================================================
-- 4. admin_resolve_report: 신고 처리
-- p_action: keep(문제없음 → 숨김이면 다시 보이게, 신고 kept) / remove(삭제 → 내용 내림, 신고 removed)
-- 작성자가 이미 지운 글·댓글(deleted)은 그대로 두고 신고만 닫는다
-- =========================================================
create function public.admin_resolve_report(p_type text, p_id bigint, p_action text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_closed integer;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  if p_type not in ('survey', 'post', 'comment') or p_action not in ('keep', 'remove') then
    raise exception 'invalid_request';
  end if;

  if p_action = 'keep' then
    if p_type = 'survey' then
      update public.surveys set moderation = 'visible' where id = p_id and moderation = 'hidden';
    elsif p_type = 'post' then
      update public.posts set moderation = 'visible' where id = p_id and moderation = 'hidden';
    else
      update public.comments set moderation = 'visible' where id = p_id and moderation = 'hidden';
    end if;
  else
    if p_type = 'survey' then
      update public.surveys set moderation = 'removed' where id = p_id and moderation in ('visible', 'hidden');
    elsif p_type = 'post' then
      update public.posts set moderation = 'removed' where id = p_id and moderation in ('visible', 'hidden');
    else
      update public.comments set moderation = 'removed' where id = p_id and moderation in ('visible', 'hidden');
    end if;
  end if;

  update public.reports
     set status = case p_action when 'keep' then 'kept' else 'removed' end
   where target_type = p_type and target_id = p_id and status = 'pending';
  get diagnostics v_closed = row_count;

  -- 이미 다른 기기에서 처리했으면 0 → 앱은 목록만 새로 불러온다
  return v_closed;
end;
$$;

-- =========================================================
-- 5. admin_get_feedback: 답변 전 의견 (오래된 순. 보낸 사람은 보여 주지 않음)
-- =========================================================
create function public.admin_get_feedback()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', id, 'category', category, 'body', body, 'screen', screen,
             'device', device, 'created_at', created_at
           )
           order by created_at
         ), '[]'::jsonb)
    into v_result
    from public.feedback
   where status = 'pending';

  return v_result;
end;
$$;

-- =========================================================
-- 6. admin_reply_feedback: 의견에 답변 (p_status: answered 답변함 / done 반영함)
-- =========================================================
create function public.admin_reply_feedback(p_id bigint, p_reply text, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reply text := btrim(coalesce(p_reply, ''));
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  if p_status not in ('answered', 'done') then
    raise exception 'invalid_request';
  end if;
  if char_length(v_reply) = 0 then
    raise exception 'reply_empty';
  end if;
  if char_length(v_reply) > 1000 then
    raise exception 'reply_too_long';
  end if;

  update public.feedback
     set reply = v_reply, status = p_status, replied_at = now()
   where id = p_id;
  if not found then
    raise exception 'feedback_not_found';
  end if;
end;
$$;

-- =========================================================
-- 7. admin_get_pending_orgs: 승인 대기 단체 (먼저 신청한 순)
-- =========================================================
create function public.admin_get_pending_orgs()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', p.id, 'name', o.name, 'kind', o.kind, 'school', u.name,
             'evidence_url', o.evidence_url, 'description', o.description,
             -- 공식 메일인지 확인용 (단체 계정만, 개인 학생 메일은 보여 주지 않는다)
             'email', au.email,
             'created_at', o.created_at
           )
           order by o.created_at
         ), '[]'::jsonb)
    into v_result
    from public.profiles p
    join public.organizations o on o.id = p.id
    left join public.universities u on u.id = o.university_id
    left join auth.users au on au.id = p.id
   where p.account_type = 'org' and p.approval_status = 'pending';

  return v_result;
end;
$$;

-- =========================================================
-- 8. admin_decide_org: 단체 승인 / 거절(사유 필수, 단체는 사유를 보고 다시 신청)
-- =========================================================
create function public.admin_decide_org(p_user_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  if not p_approve and char_length(v_reason) = 0 then
    raise exception 'reject_reason_required';
  end if;
  if char_length(v_reason) > 200 then
    raise exception 'reject_reason_too_long';
  end if;

  update public.profiles
     set approval_status = case when p_approve then 'approved' else 'rejected' end
   where id = p_user_id and account_type = 'org' and approval_status = 'pending';
  if not found then
    raise exception 'org_not_pending';
  end if;

  update public.organizations
     set reject_reason = case when p_approve then null else v_reason end
   where id = p_user_id;
end;
$$;

-- =========================================================
-- 권한: 로그인한 사람만 부를 수 있고, 함수 안에서 운영자인지 다시 확인한다
-- =========================================================
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.admin_get_counts() from public, anon;
revoke execute on function public.admin_get_reports() from public, anon;
revoke execute on function public.admin_resolve_report(text, bigint, text) from public, anon;
revoke execute on function public.admin_get_feedback() from public, anon;
revoke execute on function public.admin_reply_feedback(bigint, text, text) from public, anon;
revoke execute on function public.admin_get_pending_orgs() from public, anon;
revoke execute on function public.admin_decide_org(uuid, boolean, text) from public, anon;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_get_counts() to authenticated;
grant execute on function public.admin_get_reports() to authenticated;
grant execute on function public.admin_resolve_report(text, bigint, text) to authenticated;
grant execute on function public.admin_get_feedback() to authenticated;
grant execute on function public.admin_reply_feedback(bigint, text, text) to authenticated;
grant execute on function public.admin_get_pending_orgs() to authenticated;
grant execute on function public.admin_decide_org(uuid, boolean, text) to authenticated;
