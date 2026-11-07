-- 설문 보상 연락처 (2026-11-07 팀 피드백 6: 기프티콘 등 보상 지급용 휴대폰 번호)
--
-- 작성자가 "보상 연락처 받기"를 켜고 보상 안내(무엇을·몇 명·언제·문의 링크)를 쓰면,
-- 응답을 마친 사람이 원할 때만 휴대폰 번호를 남긴다. 그 설문 작성자에게 넘어가는 "제3자 제공"이라 안전장치:
--   - 응답자가 직접 동의 (받는 사람·목적·항목·보관 기간), 남기기는 선택
--   - 작성자만 볼 수 있고, 번호만 무작위 순서로 (누가 어떤 답을 했는지 연결 안 됨 = 답 익명성 유지)
--   - 남긴 날부터 reward_contact_keep_days일 뒤 자동 삭제, 작성자가 지급 후 직접 지울 수도 있음
--   - 응답 표·CSV·데이터 탭과 완전히 다른 표
--   1. 설정값 · 2. survey_rewards · 3. reward_contacts · 4. 함수 · 5. 자동 삭제 함수에 추가

-- =========================================================
-- 1. 설정값
-- =========================================================
insert into public.point_rules (key, value, description) values
  ('reward_contact_keep_days', 30, '보상 연락처 보관 일수 (남긴 날부터, 지나면 자동 삭제. 개인정보처리방침과 같게)');

-- =========================================================
-- 2. 보상 안내 (있으면 "보상 연락처를 받는 설문")
-- =========================================================
create table public.survey_rewards (
  survey_id bigint primary key references public.surveys (id) on delete cascade,
  -- 작성자가 쓰는 보상 안내 (예: 추첨 5명 스타벅스 기프티콘, 11/30 지급, 문의 오픈카톡 링크)
  note text not null check (char_length(note) between 2 and 300),
  -- 작성자가 "보상 지급에만 쓰고 지급 후 지울게요"에 동의한 시각
  agreed_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.survey_rewards enable row level security;

-- 볼 수 있는 설문의 보상 안내만 (설문 RLS를 그대로 따른다). 쓰기는 set_survey_reward로만
create policy "볼 수 있는 설문의 보상 안내를 읽을 수 있다"
  on public.survey_rewards for select
  to authenticated
  using (exists (select 1 from public.surveys s where s.id = survey_id));

revoke all on public.survey_rewards from anon, authenticated;
grant select on public.survey_rewards to authenticated;

-- =========================================================
-- 3. 보상 연락처 (앱에서 직접 읽기·쓰기 불가 = 정책 없음, 함수로만)
-- =========================================================
create table public.reward_contacts (
  survey_id bigint not null references public.surveys (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 휴대폰 번호 숫자만 (01012345678)
  phone text not null check (phone ~ '^01[016789][0-9]{7,8}$'),
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  -- 한 설문에 한 사람 한 번 (다시 남기면 바꿔 씀)
  primary key (survey_id, user_id)
);

alter table public.reward_contacts enable row level security;
revoke all on public.reward_contacts from anon, authenticated;

-- =========================================================
-- 4. 함수
-- =========================================================

-- 작성자: 보상 안내 켜기·바꾸기 (작성자 동의 시각을 함께 기록)
create function public.set_survey_reward(p_survey_id bigint, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_note text := btrim(coalesce(p_note, ''));
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.surveys where id = p_survey_id and owner_id = v_uid) then
    raise exception 'not_survey_owner';
  end if;
  if char_length(v_note) not between 2 and 300 then
    raise exception 'invalid_reward_note';
  end if;
  insert into public.survey_rewards (survey_id, note, agreed_at)
  values (p_survey_id, v_note, now())
  on conflict (survey_id) do update set note = excluded.note, agreed_at = excluded.agreed_at;
end;
$$;

revoke execute on function public.set_survey_reward(bigint, text) from public, anon;
grant execute on function public.set_survey_reward(bigint, text) to authenticated;

-- 응답자: 보상 연락처 남기기. 동의 필수 · 보상 설문 · 내가 응답을 마친(confirmed) 설문만
create function public.submit_reward_contact(p_survey_id bigint, p_phone text, p_consent boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_consent is not true then
    raise exception 'consent_required';
  end if;
  if not exists (select 1 from public.survey_rewards where survey_id = p_survey_id) then
    raise exception 'not_reward_survey';
  end if;
  if not exists (select 1 from public.responses
                  where survey_id = p_survey_id and user_id = v_uid and status = 'confirmed') then
    raise exception 'not_responded';
  end if;
  if v_phone !~ '^01[016789][0-9]{7,8}$' then
    raise exception 'invalid_phone';
  end if;
  insert into public.reward_contacts (survey_id, user_id, phone, consented_at)
  values (p_survey_id, v_uid, v_phone, now())
  on conflict (survey_id, user_id) do update
    set phone = excluded.phone, consented_at = excluded.consented_at, created_at = now();
end;
$$;

revoke execute on function public.submit_reward_contact(bigint, text, boolean) from public, anon;
grant execute on function public.submit_reward_contact(bigint, text, boolean) to authenticated;

-- 응답자: 내가 이 설문에 연락처를 남겼는지 (완료 화면에서 "남겼어요" 표시용, 번호는 안 돌려줌)
create function public.has_my_reward_contact(p_survey_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.reward_contacts
                  where survey_id = p_survey_id and user_id = auth.uid());
$$;

revoke execute on function public.has_my_reward_contact(bigint) from public, anon;
grant execute on function public.has_my_reward_contact(bigint) to authenticated;

-- 작성자: 남은 연락처 목록. 번호만, 무작위 순서 (응답·시각과 연결 안 되게). 보관 기간 지난 것 제외
create function public.get_reward_contacts(p_survey_id bigint)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.surveys where id = p_survey_id and owner_id = v_uid) then
    raise exception 'not_survey_owner';
  end if;
  return coalesce(
    (select array_agg(phone order by random())
       from public.reward_contacts
      where survey_id = p_survey_id
        and created_at >= now() - make_interval(days => public.point_rule('reward_contact_keep_days')::integer)),
    '{}'::text[]);
end;
$$;

revoke execute on function public.get_reward_contacts(bigint) from public, anon;
grant execute on function public.get_reward_contacts(bigint) to authenticated;

-- 작성자: 보상 지급이 끝나면 모두 지우기
create function public.clear_reward_contacts(p_survey_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.surveys where id = p_survey_id and owner_id = v_uid) then
    raise exception 'not_survey_owner';
  end if;
  delete from public.reward_contacts where survey_id = p_survey_id;
end;
$$;

revoke execute on function public.clear_reward_contacts(bigint) from public, anon;
grant execute on function public.clear_reward_contacts(bigint) to authenticated;

-- =========================================================
-- 5. 보관 기간이 지난 개인정보 지우기에 보상 연락처 추가 (20261107000003 기반)
-- =========================================================
create or replace function public.purge_expired_personal_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.partnership_inquiries
   where created_at < now() - make_interval(days => public.point_rule('partnership_keep_days')::integer);
  delete from public.reward_contacts
   where created_at < now() - make_interval(days => public.point_rule('reward_contact_keep_days')::integer);
end;
$$;

revoke execute on function public.purge_expired_personal_data() from public, anon, authenticated;
