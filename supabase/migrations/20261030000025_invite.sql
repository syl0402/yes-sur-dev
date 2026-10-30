-- 친구 초대 (2026-10-30)
--
-- 학생마다 초대 코드(6자리). 친구는 가입 후 invite_window_days일 안에 마이 탭에서 코드를 한 번 입력.
-- 포인트: 초대한 사람 invite_reward_inviter (한 달 invite_monthly_max명까지), 친구 invite_reward_invitee.
-- 악용 방지: 웰컴 포인트를 받은 계정만 입력 가능 (탈퇴 후 재가입은 웰컴이 없음 → 초대 보상 반복 불가),
--           내 코드 입력 불가, 한 계정 한 번 (invites.invitee_id 고유)

insert into public.point_rules (key, value, description) values
  ('invite_reward_inviter', 300, '친구 초대: 초대한 사람 포인트'),
  ('invite_reward_invitee', 200, '친구 초대: 초대받은 사람 포인트'),
  ('invite_window_days',    7,   '가입 후 이 날짜 안에만 초대 코드 입력'),
  ('invite_monthly_max',    10,  '초대한 사람이 한 달에 포인트를 받는 최대 인원');

alter table public.point_ledger drop constraint point_ledger_reason_check;
alter table public.point_ledger add constraint point_ledger_reason_check
  check (reason in ('welcome', 'survey_reward', 'survey_create', 'survey_refund',
                    'data_view', 'data_share', 'balance_vote', 'daily_question', 'streak_bonus',
                    'community', 'creator_bonus', 'invite'));

alter table public.profiles add column invite_code text unique;

create table public.invites (
  id bigint generated always as identity primary key,
  -- 한 사람은 한 번만 초대받을 수 있다
  invitee_id uuid not null unique references public.profiles (id) on delete cascade,
  inviter_id uuid references public.profiles (id) on delete set null,
  -- 초대한 사람이 포인트를 받았나 (한 달 최대를 넘으면 false)
  inviter_rewarded boolean not null,
  created_at timestamptz not null default now()
);

alter table public.invites enable row level security;
revoke all on public.invites from anon, authenticated;

-- 헷갈리는 글자(0·O·1·I)를 뺀 6자리
create function public.new_invite_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where invite_code = v_code);
  end loop;
  return v_code;
end;
$$;

revoke execute on function public.new_invite_code() from public, anon, authenticated;

-- 내 초대 정보 → { code, invited, can_redeem, deadline, inviter_reward, invitee_reward }
create function public.get_my_invite()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_deadline timestamptz;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_profile from public.profiles where id = v_uid for update;
  if v_profile.account_type <> 'student' then
    raise exception 'invite_student_only';
  end if;
  -- 처음 열 때 코드를 만든다
  if v_profile.invite_code is null then
    update public.profiles set invite_code = public.new_invite_code() where id = v_uid
    returning * into v_profile;
  end if;
  v_deadline := v_profile.created_at + make_interval(days => public.point_rule('invite_window_days')::integer);

  return jsonb_build_object(
    'code', v_profile.invite_code,
    'invited', (select count(*) from public.invites where inviter_id = v_uid),
    'can_redeem', now() < v_deadline
                  and not exists (select 1 from public.invites where invitee_id = v_uid)
                  and exists (select 1 from public.point_ledger where user_id = v_uid and reason = 'welcome'),
    'deadline', v_deadline,
    'inviter_reward', public.point_rule('invite_reward_inviter'),
    'invitee_reward', public.point_rule('invite_reward_invitee')
  );
end;
$$;

-- 친구 초대 코드 입력 → { reward }
create function public.redeem_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_inviter uuid;
  v_month integer;
  v_rewarded boolean;
  v_reward integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_profile from public.profiles where id = v_uid for update;
  if v_profile.account_type <> 'student' then
    raise exception 'invite_student_only';
  end if;
  if now() >= v_profile.created_at + make_interval(days => public.point_rule('invite_window_days')::integer)
     or not exists (select 1 from public.point_ledger where user_id = v_uid and reason = 'welcome') then
    raise exception 'invite_expired';
  end if;

  select id into v_inviter from public.profiles
   where invite_code = upper(btrim(coalesce(p_code, ''))) and account_type = 'student';
  if v_inviter is null or v_inviter = v_uid then
    raise exception 'invalid_invite';
  end if;

  -- 초대한 사람 한 달 최대 (동시에 여러 친구가 입력해도 넘지 않게 잠근다)
  perform 1 from public.profiles where id = v_inviter for update;
  select count(*) into v_month from public.invites
   where inviter_id = v_inviter and inviter_rewarded and created_at > now() - interval '30 days';
  v_rewarded := v_month < public.point_rule('invite_monthly_max');

  begin
    insert into public.invites (invitee_id, inviter_id, inviter_rewarded) values (v_uid, v_inviter, v_rewarded);
  exception when unique_violation then
    raise exception 'invite_used';
  end;

  v_reward := public.point_rule('invite_reward_invitee')::integer;
  insert into public.point_ledger (user_id, amount, status, reason, ref_id)
  values (v_uid, v_reward, 'confirmed', 'invite', 'invitee');
  if v_rewarded then
    insert into public.point_ledger (user_id, amount, status, reason, ref_id)
    values (v_inviter, public.point_rule('invite_reward_inviter')::integer, 'confirmed', 'invite', 'inviter');
  end if;

  return jsonb_build_object('reward', v_reward);
end;
$$;

revoke execute on function public.get_my_invite() from public, anon;
revoke execute on function public.redeem_invite(text) from public, anon;
grant execute on function public.get_my_invite() to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;
