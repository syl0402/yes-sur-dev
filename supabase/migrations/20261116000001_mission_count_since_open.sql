-- 2026-11-15 웰컴 미션: 미션이 "열린 날부터" 한 행동만 인정 (사용자 결정)
-- · 예전: 지금까지 한 행동을 모두 세서, 미리 해 둔 행동만으로 미션이 저절로 끝났다
-- · 이제: 그 미션이 열린 날(시작일 + 일차 - 1, 한국 0시) 이후의 행동만 센다. 지난 미션은 기간 안에 계속 열려 있어 몰아서 해도 된다
-- · 예외 2개 (사용자 결정 A안)
--   - about_me(관심사 알려 주기): 행동이 아니라 상태. 가입 마지막 화면에서 이미 고른 사람이 다시 하지 않게 "저장돼 있으면 완료"
--   - final_feedback(최종 피드백 설문): 설문은 11/26에 올라오고 14일차는 11/27에 열린다. 미리 답한 사람도 인정
-- · 이미 받은 미션·포인트는 그대로 둔다 (빼앗지 않음)
-- · 옛 2개짜리 mission_count(uuid, text)는 그대로 두고, 일차를 받는 3개짜리를 새로 만들어 get_my_missions·claim_mission이 쓴다

create function public.mission_count(p_uid uuid, p_condition text, p_day integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with since as (
    select ((coalesce((select started_on from public.mission_progress where user_id = p_uid),
                      (now() at time zone 'Asia/Seoul')::date) + (p_day - 1))::timestamp at time zone 'Asia/Seoul') as at
  )
  select case p_condition
    when 'quiz' then (select count(*) from public.mission_progress where user_id = p_uid and quiz_passed_at >= s.at)
    -- 예외: 상태 (언제 저장했든)
    when 'about_me' then (select count(*) from public.profile_extras where user_id = p_uid and cardinality(interests) > 0)
    when 'daily_answer' then (select count(*) from public.daily_answers where user_id = p_uid and created_at >= s.at)
    when 'survey_response' then (select count(*) from public.responses where user_id = p_uid and status = 'confirmed' and submitted_at >= s.at)
    when 'post_vote' then (select count(*) from public.post_votes where user_id = p_uid and created_at >= s.at)
    when 'data_view' then (select count(*) from public.survey_views where user_id = p_uid and created_at >= s.at)
    when 'bookmark' then (select count(*) from public.hub_bookmarks where user_id = p_uid and created_at >= s.at)
    when 'worldcup' then (select count(*) from public.worldcup_plays where user_id = p_uid and created_at >= s.at)
    when 'post' then (select count(*) from public.posts where author_id = p_uid and moderation <> 'removed' and created_at >= s.at)
    when 'comment' then (select count(*) from public.comments where author_id = p_uid and moderation not in ('removed', 'deleted') and created_at >= s.at)
    when 'survey_create' then (select count(*) from public.surveys where owner_id = p_uid and created_at >= s.at)
    when 'feedback' then (select count(*) from public.feedback where user_id = p_uid and created_at >= s.at)
    when 'share' then (select count(*) from public.share_logs where user_id = p_uid and created_at >= s.at)
    -- 예외: 최종 설문은 미리 답해도 인정
    when 'final_feedback' then (
      select count(*) from public.responses r join public.surveys sv on sv.id = r.survey_id
       where r.user_id = p_uid and r.status = 'confirmed' and sv.title like '[최종 피드백]%')
    else 0
  end::integer
  from since s;
$$;
revoke execute on function public.mission_count(uuid, text, integer) from public, anon, authenticated;

-- 아래 두 함수는 20261112000001과 같고, mission_count에 일차(m.day)를 넘기는 것만 다르다
-- 내 미션 화면. 시작 전이면 started_on = null
-- status: locked(아직 안 열림) · open(열림, 조건 미달) · ready(보상 받기 가능) · done(받음)
create or replace function public.get_my_missions()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_on date;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_day integer;
  v_missions jsonb;
  v_bonuses jsonb;
  v_earned integer;
  v_total integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select started_on into v_on from public.mission_progress where user_id = v_uid;
  -- 오늘이 몇 일차인지 (시작 전이면 1일차로 보여 준다)
  v_day := case when v_on is null then 1 else (v_today - v_on) + 1 end;

  select coalesce(jsonb_agg(jsonb_build_object(
           'code', m.code, 'day', m.day, 'title', m.title, 'description', m.description,
           'href', m.href, 'target', m.target,
           'progress', least(public.mission_count(v_uid, m.condition, m.day), m.target),
           'reward', public.point_rule(m.reward_key)::integer,
           'unlock_in', greatest(m.day - v_day, 0),
           'status', case
             when c.code is not null then 'done'
             when m.day > v_day then 'locked'
             when public.mission_count(v_uid, m.condition, m.day) >= m.target then 'ready'
             else 'open' end
         ) order by m.day), '[]'::jsonb)
    into v_missions
    from public.missions m
    left join public.mission_claims c on c.user_id = v_uid and c.code = m.code
   where m.active;

  select jsonb_build_array(
           jsonb_build_object('code', 'bonus_week', 'reward', public.point_rule('mission_bonus_week')::integer,
             'done', exists (select 1 from public.mission_claims where user_id = v_uid and code = 'bonus_week')),
           jsonb_build_object('code', 'bonus_all', 'reward', public.point_rule('mission_bonus_all')::integer,
             'done', exists (select 1 from public.mission_claims where user_id = v_uid and code = 'bonus_all')))
    into v_bonuses;

  select coalesce(sum(amount), 0)::integer into v_earned from public.mission_claims where user_id = v_uid;
  select coalesce(sum(public.point_rule(reward_key)), 0)::integer
           + public.point_rule('mission_bonus_week')::integer + public.point_rule('mission_bonus_all')::integer
    into v_total
    from public.missions where active;

  return jsonb_build_object('started_on', v_on, 'today_day', v_day, 'earned', v_earned, 'total', v_total,
                            'missions', v_missions, 'bonuses', v_bonuses);
end;
$$;

-- 보상 받기. 서버가 열렸는지·조건을 채웠는지 확인하고 미션 포인트 + (해당되면) 보너스를 한 번에 지급
-- 돌려주는 값: { reward, bonuses: [{code, amount}] }
create or replace function public.claim_mission(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_on date;
  v_day integer;
  v_m public.missions%rowtype;
  v_reward integer;
  v_bonus integer;
  v_bonuses jsonb := '[]'::jsonb;
  v_week_count integer;
  v_week_total integer;
  v_all_count integer;
  v_all_total integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  -- 진행 행을 잠근다: 버튼을 연타해도 하나씩 처리
  select started_on into v_on from public.mission_progress where user_id = v_uid for update;
  if not found then
    raise exception 'mission_not_started';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and account_type = 'student') then
    raise exception 'students_only';
  end if;

  select * into v_m from public.missions where code = p_code and active;
  if not found then
    raise exception 'mission_not_found';
  end if;
  v_day := ((now() at time zone 'Asia/Seoul')::date - v_on) + 1;
  if v_m.day > v_day then
    raise exception 'mission_locked';
  end if;
  if exists (select 1 from public.mission_claims where user_id = v_uid and code = p_code) then
    raise exception 'mission_already_claimed';
  end if;
  if public.mission_count(v_uid, v_m.condition, v_m.day) < v_m.target then
    raise exception 'mission_not_done';
  end if;

  v_reward := public.point_rule(v_m.reward_key)::integer;
  insert into public.mission_claims (user_id, code, amount) values (v_uid, p_code, v_reward);
  if v_reward > 0 then
    insert into public.point_ledger (user_id, amount, status, reason, ref_id)
    values (v_uid, v_reward, 'confirmed', 'mission', p_code);
  end if;

  -- 1주 완주: 1~7일차 미션을 모두 받았으면
  select count(*) into v_week_total from public.missions where active and day <= 7;
  select count(*) into v_week_count from public.missions m
    join public.mission_claims c on c.user_id = v_uid and c.code = m.code
   where m.active and m.day <= 7;
  if v_week_total > 0 and v_week_count = v_week_total
     and not exists (select 1 from public.mission_claims where user_id = v_uid and code = 'bonus_week') then
    v_bonus := public.point_rule('mission_bonus_week')::integer;
    insert into public.mission_claims (user_id, code, amount) values (v_uid, 'bonus_week', v_bonus);
    if v_bonus > 0 then
      insert into public.point_ledger (user_id, amount, status, reason, ref_id)
      values (v_uid, v_bonus, 'confirmed', 'mission_bonus', 'bonus_week');
    end if;
    v_bonuses := v_bonuses || jsonb_build_object('code', 'bonus_week', 'amount', v_bonus);
  end if;

  -- 14일 완주: 모든 미션을 받았으면
  select count(*) into v_all_total from public.missions where active;
  select count(*) into v_all_count from public.missions m
    join public.mission_claims c on c.user_id = v_uid and c.code = m.code
   where m.active;
  if v_all_total > 0 and v_all_count = v_all_total
     and not exists (select 1 from public.mission_claims where user_id = v_uid and code = 'bonus_all') then
    v_bonus := public.point_rule('mission_bonus_all')::integer;
    insert into public.mission_claims (user_id, code, amount) values (v_uid, 'bonus_all', v_bonus);
    if v_bonus > 0 then
      insert into public.point_ledger (user_id, amount, status, reason, ref_id)
      values (v_uid, v_bonus, 'confirmed', 'mission_bonus', 'bonus_all');
    end if;
    v_bonuses := v_bonuses || jsonb_build_object('code', 'bonus_all', 'amount', v_bonus);
  end if;

  return jsonb_build_object('reward', v_reward, 'bonuses', v_bonuses);
end;
$$;

-- "지금까지 응답한 설문을 모두 세요" 설명이 이제 틀려서 고친다
update public.missions
   set description = '이 미션이 열린 날부터 설문 3개에 응답해요. 미리 한 응답은 세지 않아요'
 where code = 'survey_3';

select day, code, description from public.missions where active and code = 'survey_3';
