-- 2026-11-15 운영자 화면 [설문] 탭: 공식 설문(운영자가 올린 설문) 마감 연장을 폰으로
-- · 운영자만 부를 수 있다 (is_admin 아니면 거부)
-- · 공식 설문만: 테스터·단체가 올린 설문은 건드리지 않는다
-- · 늘리기만 가능 (줄이면 응답 중인 사람이 갑자기 마감을 맞음)
-- · 한도: 오늘부터 설문 최대 기간(point_rules 'survey_max_days')까지. 새 설문 등록 규칙과 같다
-- · 마감이 이미 지난 설문은 늘리지 않는다 (마감된 설문은 결과 공개 흐름이 시작됨)

-- 진행 중인 공식 설문 (마감 빠른 순)
create function public.admin_get_official_surveys()
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

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id,
             'title', s.title,
             'closes_at', s.closes_at,
             'close_day', to_char(s.closes_at at time zone 'Asia/Seoul', 'MM/DD'),
             'days_left', (s.closes_at at time zone 'Asia/Seoul')::date - (now() at time zone 'Asia/Seoul')::date,
             'responses', s.response_count,
             'target', s.target_responses
           ) order by s.closes_at, s.id)
      from public.surveys s
      join public.profiles p on p.id = s.owner_id and p.role = 'admin'
     where s.status = 'open'
       and s.closes_at > now()
  ), '[]'::jsonb);
end;
$$;

-- 마감 연장. 돌려주는 값: 새 마감 시각
create function public.admin_extend_survey(p_id bigint, p_days integer)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_closes timestamptz;
  v_new timestamptz;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  if p_days is null or p_days < 1 then
    raise exception 'invalid_extend';
  end if;

  select s.closes_at into v_closes
    from public.surveys s
    join public.profiles p on p.id = s.owner_id and p.role = 'admin'
   where s.id = p_id and s.status = 'open'
   for update of s;
  if v_closes is null or v_closes <= now() then
    raise exception 'survey_closed';
  end if;

  v_new := v_closes + make_interval(days => p_days);
  if v_new > now() + make_interval(days => public.point_rule('survey_max_days')::integer) then
    raise exception 'extend_too_far';
  end if;

  update public.surveys set closes_at = v_new where id = p_id;
  return v_new;
end;
$$;

revoke execute on function public.admin_get_official_surveys() from public, anon;
revoke execute on function public.admin_extend_survey(bigint, integer) from public, anon;
grant execute on function public.admin_get_official_surveys() to authenticated;
grant execute on function public.admin_extend_survey(bigint, integer) to authenticated;
