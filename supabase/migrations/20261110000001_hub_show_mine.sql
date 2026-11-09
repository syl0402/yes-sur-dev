-- 데이터 탭에 내 설문도 보이게 (2026-11-10 개인 피드백 5번)
-- 지금까지는 내 설문을 데이터 목록에서 뺐다. 이제 "다른 사람에게 보이는 조건"을 만족한 내 설문만 함께 보이고,
-- 앱이 "내 설문" 표시를 붙일 수 있게 mine 값을 내보낸다.
--   - 다른 사람 설문: 지금과 같은 survey_listed 규칙
--   - 내 설문: survey_listed는 작성자에게 늘 true라서 쓰지 않고, 남에게 보이는 조건을 직접 확인
--     (마감 + 유효 응답 result_min_count 이상 + 비공개 아님 + 신고로 숨겨지지 않음).
--     우리 학교만 공개는 작성자 학교 = 내 학교라서 따로 볼 필요 없음
-- 20261107000001의 get_hub_list에서 where 조건과 출력(mine)만 바뀐다.

create or replace function public.get_hub_list(p_category text default null, p_sort text default 'popular')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_org boolean;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select account_type = 'org' into v_is_org from public.profiles where id = v_uid;

  with rows as (
    select s.id, s.title, s.host_name, s.host_verified, s.response_count, s.question_count,
           coalesce(s.closes_at, s.created_at) as ended_at,
           c.key as category_key, c.name as category_name,
           (select count(*) from public.survey_views v where v.survey_id = s.id)::integer as view_count,
           (select count(*) from public.responses r where r.survey_id = s.id)::integer as all_count,
           exists (select 1 from public.survey_views v where v.survey_id = s.id and v.user_id = v_uid) as viewed,
           exists (select 1 from public.responses r
                    where r.survey_id = s.id and r.user_id = v_uid and r.status = 'confirmed') as answered,
           s.owner_id is not distinct from v_uid as mine,
           public.survey_free_reason(s.id) as free_reason,
           public.survey_tag_list(s.id) as tags
      from public.surveys s
      join public.survey_categories c on c.id = s.category_id
     where (
             (s.owner_id is distinct from v_uid and public.survey_listed(s.id, v_uid))
             or (s.owner_id = v_uid
                 and s.moderation = 'visible'
                 and s.result_visibility <> 'private'
                 and (s.status <> 'open' or (s.closes_at is not null and s.closes_at <= now()))
                 and s.response_count >= public.point_rule('result_min_count'))
           )
       and (p_category is null or c.key = p_category)
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', id, 'title', title, 'host_name', host_name, 'host_verified', host_verified,
             'category_key', category_key, 'category_name', category_name,
             'response_count', response_count, 'view_count', view_count, 'ended_at', ended_at,
             'viewed', viewed, 'answered', answered, 'mine', mine,
             'free', free_reason is not null or v_is_org,
             'trusted', response_count >= public.point_rule('trust_min_responses')
                        and all_count > 0
                        and response_count::numeric / all_count >= public.point_rule('trust_min_pass_rate'),
             'low_count', response_count < public.point_rule('low_response_warning'),
             'tags', tags
           )
           order by
             case when p_sort = 'responses' then response_count end desc nulls last,
             case when p_sort = 'latest' then ended_at end desc nulls last,
             case when coalesce(p_sort, 'popular') = 'popular' then view_count end desc nulls last,
             ended_at desc
         ), '[]'::jsonb)
    into v_result
    from rows;

  return v_result;
end;
$$;
