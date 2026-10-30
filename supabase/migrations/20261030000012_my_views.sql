-- 마이 탭 "열람한 결과" 목록 (2026-10-30)
--
-- 내가 열람한 설문 + 제목·주최. 최신 열람순.
-- 설문 표를 앱이 직접 읽으면 다른 학교의 "우리 학교만" 설문은 제목이 안 보인다 (응답 대상 RLS).
-- 열람 기록이 있는 설문만 제목을 알려 주므로, 다른 설문 정보가 새지 않는다.
--
-- 돌려주는 모양: [{ survey_id, title, host_name, host_verified, viewed_at, paid }]

create function public.get_my_views()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'survey_id', s.id,
             'title', s.title,
             'host_name', s.host_name,
             'host_verified', s.host_verified,
             'viewed_at', v.created_at,
             'paid', v.paid
           ) order by v.created_at desc), '[]'::jsonb)
    from public.survey_views v
    join public.surveys s on s.id = v.survey_id
   where v.user_id = auth.uid();
$$;

revoke execute on function public.get_my_views() from public, anon;
grant execute on function public.get_my_views() to authenticated;
