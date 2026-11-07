-- 진행 중인 설문의 설명·보상 안내 고치기 (2026-11-08 팀 피드백)
--
-- 시중 설문 서비스처럼: 문항·선택지·제목·인원은 응답이 섞이지 않게 잠그고, 안내 글만 고칠 수 있다.
--   1. update_survey_texts(): 설명 + 보상 안내(비우면 보상 안내 유지, 새로 적으면 켜짐)
--   2. set_survey_reward()에 금칙어 검사 추가 (20261107000006 기반)
-- 보상 안내는 한 번 켜면 끌 수 없다 (이미 연락처를 남긴 사람이 있을 수 있어서). 고치기만 가능

-- =========================================================
-- 1. 설명·보상 안내 고치기 (작성자만 · 마감 전만)
-- =========================================================
create function public.update_survey_texts(p_survey_id bigint, p_description text, p_reward_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_survey public.surveys%rowtype;
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_note text := nullif(btrim(coalesce(p_reward_note, '')), '');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_survey from public.surveys where id = p_survey_id and owner_id = v_uid for update;
  if not found then
    raise exception 'not_survey_owner';
  end if;
  if v_survey.status <> 'open' or (v_survey.closes_at is not null and v_survey.closes_at <= now()) then
    raise exception 'survey_closed';
  end if;
  if v_description is not null and char_length(v_description) > 500 then
    raise exception 'invalid_description';
  end if;
  if v_note is not null and char_length(v_note) not between 2 and 300 then
    raise exception 'invalid_reward_note';
  end if;
  if public.has_banned_word(v_description) or public.has_banned_word(v_note) then
    raise exception 'banned_word';
  end if;

  update public.surveys set description = v_description where id = p_survey_id;

  -- 보상 안내: 적었으면 새로 켜거나 바꾼다 (작성자 동의는 화면에서 받고 시각을 새로 기록)
  if v_note is not null then
    insert into public.survey_rewards (survey_id, note, agreed_at)
    values (p_survey_id, v_note, now())
    on conflict (survey_id) do update set note = excluded.note, agreed_at = excluded.agreed_at;
  end if;
end;
$$;

revoke execute on function public.update_survey_texts(bigint, text, text) from public, anon;
grant execute on function public.update_survey_texts(bigint, text, text) to authenticated;

-- =========================================================
-- 2. 등록 때 보상 켜기에도 금칙어 검사
-- =========================================================
create or replace function public.set_survey_reward(p_survey_id bigint, p_note text)
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
  if public.has_banned_word(v_note) then
    raise exception 'banned_word';
  end if;
  insert into public.survey_rewards (survey_id, note, agreed_at)
  values (p_survey_id, v_note, now())
  on conflict (survey_id) do update set note = excluded.note, agreed_at = excluded.agreed_at;
end;
$$;
