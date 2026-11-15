-- 2026-11-15 운영자 화면 [테스터] 탭: 테스터별 현황을 폰으로 보기 (seed/report_testers.sql을 화면으로 옮김)
-- · 운영자만 부를 수 있다 (is_admin 아니면 거부)
-- · 이메일은 가려서 준다: 체험 계정은 guest7처럼 앞부분만, 학생은 앞 3글자 + ***@도메인
--   폰 화면은 캡처되기 쉬워서 전체 이메일은 보내지 않는다. 누구인지 짝짓기에는 이걸로 충분
-- · 미션 수는 지금 미션 표 기준: 1주차 = 1~7일차, 2주차 = 8~14일차 (쉬는 미션 제외)
-- · 테스트 시작일(11/14) 전에 가입한 계정은 is_team = true (팀원·개발 기간 계정)

create function public.admin_get_tester_status()
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

  with acts as (
    select user_id, submitted_at as at from public.responses
    union all select owner_id, created_at from public.surveys
    union all select user_id, created_at from public.post_votes
    union all select author_id, created_at from public.posts
    union all select author_id, created_at from public.comments
    union all select user_id, created_at from public.worldcup_plays
    union all select user_id, created_at from public.survey_views
    union all select user_id, created_at from public.daily_answers
    union all select user_id, created_at from public.share_logs
    union all select user_id, created_at from public.feedback
    union all select user_id, created_at from public.mission_claims
  ),
  last_act as (
    select user_id, max(at) as at from acts group by user_id
  ),
  t_rows as (
    select p.id,
           p.nickname,
           case
             when u.is_demo then split_part(au.email, '@', 1)
             when au.email is null then null
             else left(split_part(au.email, '@', 1), 3) || '***@' || split_part(au.email, '@', 2)
           end as email_hint,
           case when p.account_type = 'org' then 'org' when u.is_demo then 'demo' else 'student' end as kind,
           p.created_at < timestamptz '2026-11-14 00:00+09' as is_team,
           p.created_at,
           (select count(*) from public.mission_claims c join public.missions m on m.code = c.code
             where c.user_id = p.id and m.active and m.day <= 7) as week1,
           (select count(*) from public.missions m where m.active and m.day <= 7) as week1_total,
           (select count(*) from public.mission_claims c join public.missions m on m.code = c.code
             where c.user_id = p.id and m.active and m.day > 7) as week2,
           (select count(*) from public.missions m where m.active and m.day > 7) as week2_total,
           (select count(*) from public.responses r where r.user_id = p.id and r.status = 'confirmed') as responses,
           l.at as last_active_at,
           to_char(l.at at time zone 'Asia/Seoul', 'MM/DD') as last_active_day,
           (now() at time zone 'Asia/Seoul')::date - (l.at at time zone 'Asia/Seoul')::date as idle_days,
           exists (select 1 from public.push_tokens t where t.user_id = p.id) as push_on
    from public.profiles p
    left join auth.users au on au.id = p.id
    left join public.universities u on u.id = p.university_id
    left join last_act l on l.user_id = p.id
    where p.role <> 'admin'
  )
  select coalesce(jsonb_agg(to_jsonb(r) - 'id' order by r.is_team, r.last_active_at asc nulls first, r.created_at), '[]'::jsonb)
    into v_result
  from t_rows r;

  return v_result;
end;
$$;

revoke execute on function public.admin_get_tester_status() from public, anon;
grant execute on function public.admin_get_tester_status() to authenticated;
