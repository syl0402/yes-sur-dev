-- 커뮤니티 학교 대항전 (2026-11-02, 계열 대항전을 대신)
--
-- 이번 주(한국 시간 월요일 0시부터) 학교별 활동 횟수 합계로 순위를 매긴다.
-- 활동: 커뮤니티 투표 · 오늘의 질문 답 · 글 · 댓글 · 월드컵 참여 (학생 계정만)
-- 개인 노출 방지: 이번 주 활동한 서로 다른 학생이 result_min_count(5)명 미만인 학교는 순위에서 빼고 숫자도 보내지 않는다.
-- 계열 대항전 함수(get_major_ranking)는 남겨 두고 앱에서만 바꾼다.
-- { week_start, ranking: [{ school, count, rank }], my_school, my_rank } — 누가 활동했는지는 없음

create function public.get_school_ranking()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  -- 한국 시간 이번 주 월요일 0시
  v_start timestamptz := date_trunc('week', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_min numeric := public.point_rule('result_min_count');
  v_my text;
  v_ranking jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select u.name into v_my
    from public.profiles p join public.universities u on u.id = p.university_id
   where p.id = v_uid and p.account_type = 'student';

  with acts as (
    select user_id as uid from public.post_votes where created_at >= v_start
    union all
    select user_id from public.daily_answers where created_at >= v_start
    union all
    select author_id from public.posts where created_at >= v_start and moderation <> 'deleted'
    union all
    select author_id from public.comments where created_at >= v_start and moderation <> 'deleted'
    union all
    select user_id from public.worldcup_plays where created_at >= v_start
  ),
  per_school as (
    select p.university_id, count(*)::integer as cnt, count(distinct a.uid)::integer as people
      from acts a
      join public.profiles p on p.id = a.uid and p.account_type = 'student'
     where p.university_id is not null
     group by p.university_id
  ),
  ranked as (
    select u.name as school, s.cnt, rank() over (order by s.cnt desc)::integer as rnk
      from per_school s
      join public.universities u on u.id = s.university_id
     where s.people >= v_min
  )
  select coalesce(jsonb_agg(jsonb_build_object('school', school, 'count', cnt, 'rank', rnk) order by rnk, school), '[]'::jsonb)
    into v_ranking
    from ranked;

  return jsonb_build_object(
    'week_start', (v_start at time zone 'Asia/Seoul')::date,
    'ranking', v_ranking,
    'my_school', v_my,
    'my_rank', (select (e ->> 'rank')::integer from jsonb_array_elements(v_ranking) e where e ->> 'school' = v_my)
  );
end;
$$;

revoke execute on function public.get_school_ranking() from public, anon;
grant execute on function public.get_school_ranking() to authenticated;
