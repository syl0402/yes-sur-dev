-- 데이터 허브 (2026-10-30)
--
-- 볼 수 있는 사람 (공개 범위)
-- - 전체 공개: 모든 학생·단체
-- - 우리 학교만: 작성자 학교 학생만
-- - 비공개: 아무도 (응답자 포함)
-- - 데이터 허브에는 "마감 + 유효 응답 result_min_count(5)개 이상"만 올라간다. 등록자는 항상 본다
--
-- 보는 범위
-- - 누구나: 설문 정보·응답자 구성·문항 목록 (숫자 결과 없음) → get_hub_preview
-- - 응답자: 내 답 비교 → get_my_comparison
-- - 열람(100P): 전체 결과·나눠 보기·신뢰 정보 → view_survey 후 get_full_results
--
-- 무료 열람: 1문항 설문, 옛썰 공식 설문(작성자 role=admin), 단체 계정(테스트 동안), 계정당 첫 1회(welcome)
-- 열람료의 data_share_rate(40%)는 등록자에게 간다
-- 개인정보:
-- - 나눠 보기는 한 번에 한 기준만, result_min_count(5)명 미만 그룹은 숨긴다
-- - 주관식 답, 학교·학과명, 응답 시각은 넣지 않는다

-- =========================================================
-- 1. 설정값
-- =========================================================
insert into public.point_rules (key, value, description) values
  ('trust_min_responses',  30,  '신뢰도 배지: 최소 유효 응답 수'),
  ('trust_min_pass_rate',  0.9, '신뢰도 배지: 확인 문항 최소 통과율'),
  ('low_response_warning', 10,  '이 응답 수 미만이면 "참고용" 안내');

-- =========================================================
-- 2. 열람 기록
-- free_reason: paid(포인트 냄) / one_question / official / org / welcome(첫 열람 무료)
-- =========================================================
create table public.survey_views (
  id bigint generated always as identity primary key,
  survey_id bigint not null references public.surveys (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  paid integer not null default 0 check (paid >= 0),
  free_reason text not null default 'paid'
    check (free_reason in ('paid', 'one_question', 'official', 'org', 'welcome')),
  created_at timestamptz not null default now(),
  -- 한 사람이 한 설문은 한 번만 (두 번 눌러도 한 번만 차감)
  unique (survey_id, user_id)
);

alter table public.survey_views enable row level security;

create policy "본인 열람 기록만 읽을 수 있다"
  on public.survey_views for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.survey_views from anon, authenticated;
grant select on public.survey_views to authenticated;

-- =========================================================
-- 3. 내부 도우미 (앱에서 직접 부르지 않음)
-- =========================================================

-- 유효 응답: 확정 + 확인 문항 정답 (확인 문항이 없으면 확정 전부)
create function public.survey_valid_ids(p_survey_id bigint)
returns bigint[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(r.id), '{}')
    from public.responses r
   where r.survey_id = p_survey_id
     and r.status = 'confirmed'
     and not exists (
       select 1 from public.questions q
        where q.survey_id = p_survey_id
          and q.is_attention_check
          and not exists (
            select 1 from public.answers a
             where a.response_id = r.id and a.question_id = q.id
               and q.correct_option_id = any (a.option_ids)
          )
     );
$$;

-- 데이터 허브에 보이는가 (작성자는 항상 true)
create function public.survey_listed(p_survey_id bigint, p_uid uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
           when s.owner_id = p_uid then true
           when s.result_visibility = 'private' then false
           when s.result_visibility = 'campus'
                and s.result_university_id is distinct from (select university_id from public.profiles where id = p_uid)
             then false
           else (s.status <> 'open' or (s.closes_at is not null and s.closes_at <= now()))
                and s.response_count >= public.point_rule('result_min_count')
         end
    from public.surveys s
   where s.id = p_survey_id;
$$;

-- 응답자 그룹 이름 (나눠 보기 기준 하나): major 계열 / grade 학년대 / gender 성별 / age 나이대
create function public.respondent_group(p_dim text, p_user uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case p_dim
           when 'major' then coalesce(
             (select mf.category_name from public.major_fields mf where mf.id = p.major_field_id), '미입력')
           when 'grade' then case
             when p.degree_type = 'grad' then '대학원'
             when p.admission_year is null then '미입력'
             when extract(year from now())::integer - p.admission_year + 1 <= 2 then '1~2학년'
             when extract(year from now())::integer - p.admission_year + 1 <= 4 then '3~4학년'
             else '5학년 이상' end
           when 'gender' then case p.gender
             when 'male' then '남성'
             when 'female' then '여성'
             else '선택 안 함·미입력' end
           when 'age' then case
             when p.birth_year is null then '미입력'
             when extract(year from now())::integer - p.birth_year <= 20 then '20세 이하'
             when extract(year from now())::integer - p.birth_year <= 23 then '21~23세'
             when extract(year from now())::integer - p.birth_year <= 26 then '24~26세'
             else '27세 이상' end
         end
    from public.profiles p
   where p.id = p_user;
$$;

-- 문항별 집계 (주어진 응답들로). 확인 문항 제외, 주관식은 문항만 (답 원문 없음)
create function public.question_stats(p_survey_id bigint, p_ids bigint[])
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', q.id,
             'type', q.type,
             'text', q.text,
             'answered', (select count(*) from public.answers a
                           where a.question_id = q.id and a.response_id = any (p_ids)),
             'options', case when q.type in ('single', 'multi') then (
               select coalesce(jsonb_agg(
                        jsonb_build_object(
                          'id', o.id,
                          'text', o.text,
                          'count', (select count(*) from public.answers a
                                     where a.question_id = q.id
                                       and a.response_id = any (p_ids)
                                       and o.id = any (a.option_ids))
                        ) order by o.sort_order), '[]'::jsonb)
                 from public.question_options o
                where o.question_id = q.id
             ) else '[]'::jsonb end,
             'scale', case when q.type = 'scale' then (
               select jsonb_build_object(
                        'avg', round(avg(a.scale_value)::numeric, 1),
                        'counts', jsonb_build_array(
                          count(*) filter (where a.scale_value = 1),
                          count(*) filter (where a.scale_value = 2),
                          count(*) filter (where a.scale_value = 3),
                          count(*) filter (where a.scale_value = 4),
                          count(*) filter (where a.scale_value = 5)))
                 from public.answers a
                where a.question_id = q.id and a.response_id = any (p_ids)
             ) end
           ) order by q.sort_order), '[]'::jsonb)
    from public.questions q
   where q.survey_id = p_survey_id
     and not q.is_attention_check;
$$;

-- 한 기준으로 나눈 그룹들. 그룹 인원이 result_min_count 미만이면 숫자 없이 숨김
-- p_with_stats = false면 그룹 인원만 (응답자 구성용)
create function public.survey_groups(p_survey_id bigint, p_ids bigint[], p_dim text, p_with_stats boolean)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with r as (
    select id, public.respondent_group(p_dim, user_id) as grp
      from public.responses
     where id = any (p_ids)
  ),
  g as (
    select grp, array_agg(id) as ids, count(*)::integer as n from r group by grp
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'label', grp,
             'hidden', n < public.point_rule('result_min_count'),
             'n', case when n < public.point_rule('result_min_count') then null else n end,
             'questions', case
               when p_with_stats and n >= public.point_rule('result_min_count')
                 then public.question_stats(p_survey_id, ids)
               else '[]'::jsonb end
           ) order by grp), '[]'::jsonb)
    from g;
$$;

-- 응답자 구성: 기준 4개의 그룹 인원
create function public.survey_composition(p_survey_id bigint, p_ids bigint[])
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'major',  public.survey_groups(p_survey_id, p_ids, 'major', false),
    'grade',  public.survey_groups(p_survey_id, p_ids, 'grade', false),
    'gender', public.survey_groups(p_survey_id, p_ids, 'gender', false),
    'age',    public.survey_groups(p_survey_id, p_ids, 'age', false)
  );
$$;

-- 이 설문이 공짜인 이유 (사람과 무관한 것만): one_question / official / null
create function public.survey_free_reason(p_survey_id bigint)
returns text
language sql
stable
set search_path = ''
as $$
  select case
           when s.question_count = 1 then 'one_question'
           when exists (select 1 from public.profiles p where p.id = s.owner_id and p.role = 'admin') then 'official'
         end
    from public.surveys s
   where s.id = p_survey_id;
$$;

revoke execute on function public.survey_valid_ids(bigint) from public, anon, authenticated;
revoke execute on function public.survey_listed(bigint, uuid) from public, anon, authenticated;
revoke execute on function public.respondent_group(text, uuid) from public, anon, authenticated;
revoke execute on function public.question_stats(bigint, bigint[]) from public, anon, authenticated;
revoke execute on function public.survey_groups(bigint, bigint[], text, boolean) from public, anon, authenticated;
revoke execute on function public.survey_composition(bigint, bigint[]) from public, anon, authenticated;
revoke execute on function public.survey_free_reason(bigint) from public, anon, authenticated;

-- =========================================================
-- 4. get_hub_list: 데이터 허브 목록
-- p_category: 카테고리 key (null이면 전체) / p_sort: popular(열람 많은) · latest(최근 마감) · responses(응답 많은)
-- =========================================================
create function public.get_hub_list(p_category text default null, p_sort text default 'popular')
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
           s.owner_id = v_uid as mine,
           public.survey_free_reason(s.id) as free_reason
      from public.surveys s
      join public.survey_categories c on c.id = s.category_id
     where s.owner_id <> v_uid
       and public.survey_listed(s.id, v_uid)
       and (p_category is null or c.key = p_category)
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', id, 'title', title, 'host_name', host_name, 'host_verified', host_verified,
             'category_key', category_key, 'category_name', category_name,
             'response_count', response_count, 'view_count', view_count, 'ended_at', ended_at,
             'viewed', viewed, 'answered', answered,
             'free', free_reason is not null or v_is_org,
             'trusted', response_count >= public.point_rule('trust_min_responses')
                        and all_count > 0
                        and response_count::numeric / all_count >= public.point_rule('trust_min_pass_rate'),
             'low_count', response_count < public.point_rule('low_response_warning')
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

-- =========================================================
-- 5. get_hub_preview: 무료 정보 (설문 정보·응답자 구성·문항 목록·열람 상태)
-- =========================================================
create function public.get_hub_preview(p_survey_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_survey public.surveys%rowtype;
  v_profile public.profiles%rowtype;
  v_ids bigint[];
  v_all integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_survey from public.surveys where id = p_survey_id;
  if not found then
    raise exception 'survey_not_found';
  end if;
  -- 이미 열람한 사람은 공개 범위가 좁혀져도 계속 본다
  if not public.survey_listed(p_survey_id, v_uid)
     and not exists (select 1 from public.survey_views where survey_id = p_survey_id and user_id = v_uid) then
    raise exception 'not_listed';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  v_ids := public.survey_valid_ids(p_survey_id);
  select count(*) into v_all from public.responses where survey_id = p_survey_id;

  return jsonb_build_object(
    'id', v_survey.id,
    'title', v_survey.title,
    'description', v_survey.description,
    'host_name', v_survey.host_name,
    'host_verified', v_survey.host_verified,
    'category_name', (select name from public.survey_categories where id = v_survey.category_id),
    'response_count', cardinality(v_ids),
    'started_at', v_survey.created_at,
    'ended_at', coalesce(v_survey.closes_at, now()),
    'questions', (select coalesce(jsonb_agg(jsonb_build_object('text', text, 'type', type) order by sort_order), '[]'::jsonb)
                    from public.questions where survey_id = p_survey_id and not is_attention_check),
    'composition', public.survey_composition(p_survey_id, v_ids),
    'mine', v_survey.owner_id = v_uid,
    'viewed', exists (select 1 from public.survey_views where survey_id = p_survey_id and user_id = v_uid),
    'answered', exists (select 1 from public.responses
                         where survey_id = p_survey_id and user_id = v_uid and status = 'confirmed'),
    -- 열람하면 공짜인 이유 (없으면 null → 포인트 필요)
    'free_reason', coalesce(
      public.survey_free_reason(p_survey_id),
      case when v_profile.account_type = 'org' then 'org' end,
      case when v_profile.account_type = 'student'
             and not exists (select 1 from public.survey_views where user_id = v_uid and free_reason = 'welcome')
           then 'welcome' end),
    'price', public.point_rule('cost_data_view'),
    'trusted', cardinality(v_ids) >= public.point_rule('trust_min_responses')
               and v_all > 0
               and cardinality(v_ids)::numeric / v_all >= public.point_rule('trust_min_pass_rate'),
    'low_count', cardinality(v_ids) < public.point_rule('low_response_warning')
  );
end;
$$;

-- =========================================================
-- 6. get_my_comparison: 응답자 본인의 "내 답 비교" (주관식·확인 문항 제외)
-- [{ "text", "type", "mine": ["가끔"] 또는 [4], "same_pct": [34] }]  (복수 선택은 고른 보기마다 비율)
-- =========================================================
create function public.get_my_comparison(p_survey_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_my_response bigint;
  v_ids bigint[];
  v_q record;
  v_my public.answers%rowtype;
  v_answered integer;
  v_mine jsonb;
  v_pcts jsonb;
  v_option record;
  v_result jsonb := '[]';
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not public.survey_listed(p_survey_id, v_uid) then
    raise exception 'not_listed';
  end if;
  select id into v_my_response from public.responses
   where survey_id = p_survey_id and user_id = v_uid and status = 'confirmed';
  if v_my_response is null then
    raise exception 'not_respondent';
  end if;

  v_ids := public.survey_valid_ids(p_survey_id);

  for v_q in select id, type, text from public.questions
              where survey_id = p_survey_id and not is_attention_check and type <> 'text'
              order by sort_order loop
    select * into v_my from public.answers where response_id = v_my_response and question_id = v_q.id;
    select count(*) into v_answered from public.answers where question_id = v_q.id and response_id = any (v_ids);
    v_mine := '[]';
    v_pcts := '[]';

    if v_q.type = 'scale' then
      v_mine := jsonb_build_array(v_my.scale_value);
      v_pcts := jsonb_build_array(
        case when v_answered = 0 then 0 else round(100.0 * (
          select count(*) from public.answers
           where question_id = v_q.id and response_id = any (v_ids) and scale_value = v_my.scale_value
        ) / v_answered) end);
    else
      for v_option in select id, text from public.question_options
                       where question_id = v_q.id and id = any (v_my.option_ids) order by sort_order loop
        v_mine := v_mine || jsonb_build_array(v_option.text);
        v_pcts := v_pcts || jsonb_build_array(
          case when v_answered = 0 then 0 else round(100.0 * (
            select count(*) from public.answers
             where question_id = v_q.id and response_id = any (v_ids) and v_option.id = any (option_ids)
          ) / v_answered) end);
      end loop;
    end if;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'text', v_q.text, 'type', v_q.type, 'mine', v_mine, 'same_pct', v_pcts));
  end loop;

  return v_result;
end;
$$;

-- =========================================================
-- 7. view_survey: 전체 열람 (필요하면 포인트 차감 → 등록자에게 분배 → 열람 기록)
-- 돌려주는 값: { "paid": 낸 포인트, "free_reason": 공짜인 이유 또는 'paid' }
-- 이미 열람했거나 작성자면 아무것도 하지 않는다 (중복 차감 없음)
-- =========================================================
create function public.view_survey(p_survey_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_survey public.surveys%rowtype;
  v_profile public.profiles%rowtype;
  v_reason text;
  v_cost integer := 0;
  v_balance integer;
  v_share integer;
  v_view_id bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_survey from public.surveys where id = p_survey_id;
  if not found then
    raise exception 'survey_not_found';
  end if;
  if v_survey.owner_id = v_uid then
    return jsonb_build_object('paid', 0, 'free_reason', 'owner');
  end if;

  -- 회원정보 행을 잠근다: 열람이 동시에 와도 하나씩 처리 (중복 차감·음수 잔액 방지)
  select * into v_profile from public.profiles where id = v_uid for update;

  if exists (select 1 from public.survey_views where survey_id = p_survey_id and user_id = v_uid) then
    return jsonb_build_object('paid', 0, 'free_reason', 'already');
  end if;
  if not public.survey_listed(p_survey_id, v_uid) then
    raise exception 'not_listed';
  end if;

  v_reason := coalesce(
    public.survey_free_reason(p_survey_id),
    -- TODO(임시): 단체는 테스트 동안 무료 · Q14 답이 오면 변경
    case when v_profile.account_type = 'org' then 'org' end,
    case when v_profile.account_type = 'student'
           and not exists (select 1 from public.survey_views where user_id = v_uid and free_reason = 'welcome')
         then 'welcome' end,
    'paid');

  if v_reason = 'paid' then
    v_cost := public.point_rule('cost_data_view');
    select coalesce(sum(amount), 0)::integer into v_balance
      from public.point_ledger where user_id = v_uid and status = 'confirmed';
    if v_balance < v_cost then
      raise exception 'insufficient_points';
    end if;
  end if;

  insert into public.survey_views (survey_id, user_id, paid, free_reason)
  values (p_survey_id, v_uid, v_cost, v_reason)
  returning id into v_view_id;

  if v_cost > 0 then
    insert into public.point_ledger (user_id, amount, status, reason, ref_id)
    values (v_uid, -v_cost, 'confirmed', 'data_view', p_survey_id::text);

    -- 등록자 몫. ref_id = "설문번호:열람번호" (열람한 사람이 누군지는 남기지 않는다)
    v_share := floor(v_cost * public.point_rule('data_share_rate'))::integer;
    if v_share > 0 then
      insert into public.point_ledger (user_id, amount, status, reason, ref_id)
      values (v_survey.owner_id, v_share, 'confirmed', 'data_share', p_survey_id || ':' || v_view_id);
    end if;
  end if;

  return jsonb_build_object('paid', v_cost, 'free_reason', v_reason);
end;
$$;

-- =========================================================
-- 8. get_full_results: 전체 결과 (작성자 또는 열람한 사람)
-- { total, excluded, pass_rate, avg_seconds, started_at, ended_at, view_count, share_earned(작성자만),
--   overall: [문항별 집계], groups: { major, grade, gender, age: [{ label, n, hidden, questions }] } }
-- =========================================================
create function public.get_full_results(p_survey_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_survey public.surveys%rowtype;
  v_ids bigint[];
  v_all integer;
  v_mine boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_survey from public.surveys where id = p_survey_id;
  if not found then
    raise exception 'survey_not_found';
  end if;
  v_mine := v_survey.owner_id = v_uid;
  if not v_mine
     and not exists (select 1 from public.survey_views where survey_id = p_survey_id and user_id = v_uid) then
    raise exception 'not_viewed';
  end if;

  v_ids := public.survey_valid_ids(p_survey_id);
  select count(*) into v_all from public.responses where survey_id = p_survey_id;

  return jsonb_build_object(
    'total', cardinality(v_ids),
    'excluded', v_all - cardinality(v_ids),
    'pass_rate', case when v_all = 0 then null else round(100.0 * cardinality(v_ids) / v_all) end,
    'avg_seconds', (select round(avg(duration_seconds)) from public.responses
                     where id = any (v_ids) and duration_seconds is not null),
    'started_at', v_survey.created_at,
    'ended_at', coalesce(v_survey.closes_at, now()),
    'view_count', (select count(*) from public.survey_views where survey_id = p_survey_id),
    'share_earned', case when v_mine then (
      select coalesce(sum(amount), 0) from public.point_ledger
       where user_id = v_uid and reason = 'data_share' and ref_id like p_survey_id || ':%') end,
    'overall', public.question_stats(p_survey_id, v_ids),
    'groups', jsonb_build_object(
      'major',  public.survey_groups(p_survey_id, v_ids, 'major', true),
      'grade',  public.survey_groups(p_survey_id, v_ids, 'grade', true),
      'gender', public.survey_groups(p_survey_id, v_ids, 'gender', true),
      'age',    public.survey_groups(p_survey_id, v_ids, 'age', true)
    )
  );
end;
$$;

revoke execute on function public.get_hub_list(text, text) from public, anon;
revoke execute on function public.get_hub_preview(bigint) from public, anon;
revoke execute on function public.get_my_comparison(bigint) from public, anon;
revoke execute on function public.view_survey(bigint) from public, anon;
revoke execute on function public.get_full_results(bigint) from public, anon;
grant execute on function public.get_hub_list(text, text) to authenticated;
grant execute on function public.get_hub_preview(bigint) to authenticated;
grant execute on function public.get_my_comparison(bigint) to authenticated;
grant execute on function public.view_survey(bigint) to authenticated;
grant execute on function public.get_full_results(bigint) to authenticated;
