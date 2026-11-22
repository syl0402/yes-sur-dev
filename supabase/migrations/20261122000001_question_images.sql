-- 2026-11-22 설문 문항 사진 (사진 기능 C, 사용자 결정)
-- · 문항 하나에 사진 1장 (구글폼·네이버폼과 같음). 모든 설문 등록자(학생·단체)가 붙일 수 있다
-- · 공개 저장소 content의 surveys/<내 id>/ 에 본인만 올리고 지운다. 이상한 사진은 기존 설문 신고 → 숨김으로 처리
-- · 응답 화면은 questions.image_path를 직접 읽고, 결과 화면(내 결과·데이터 탭)은 get_question_images로 받는다
-- · 설문 복사(get_survey_for_copy)에는 사진을 넣지 않는다 (나중에)
-- 바뀌는 함수: create_survey (20261114000001 복사 + 사진 부분만)

-- =========================================================
-- 1. 문항 사진 칸
-- =========================================================
alter table public.questions add column image_path text check (char_length(image_path) <= 200);
grant select (image_path) on public.questions to authenticated;

-- =========================================================
-- 2. 사진 저장소: surveys/<내 id>/ 에 본인만 올리고 지운다
-- =========================================================
create policy "공개 사진: 설문 사진은 본인 폴더에만 올린다"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'content' and (storage.foldername(name))[1] = 'surveys'
              and (storage.foldername(name))[2] = (select auth.uid())::text);

create policy "공개 사진: 설문 사진은 본인 것만 지운다"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'content' and (storage.foldername(name))[1] = 'surveys'
         and (storage.foldername(name))[2] = (select auth.uid())::text);

-- =========================================================
-- 3. create_survey: 문항마다 "image": "surveys/<내 id>/파일" (없으면 사진 없음)
--    이미 깔린 앱(업데이트 전)은 image를 안 보내서 지금과 같다
-- =========================================================
create or replace function public.create_survey(
  p_request_id uuid,
  p_category_id bigint,
  p_title text,
  p_description text,
  p_audience text,
  p_target integer,
  p_days integer,
  p_questions jsonb,
  p_result_visibility text default 'public'
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_existing bigint;
  v_title text := btrim(coalesce(p_title, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_count integer;
  v_max_options integer;
  v_q jsonb;
  v_type text;
  v_option jsonb;
  v_option_count integer;
  v_seconds integer := 0;
  v_est_minutes integer;
  v_reward integer;
  v_price integer;
  v_cost integer;
  v_balance integer;
  v_survey_id bigint;
  v_question_id bigint;
  v_order integer := 0;
  v_attention_at integer := 0;
  v_pick integer;
  v_correct bigint;
  v_i integer;
  v_img text;
  v_scale_labels text[] := array['전혀 아니에요', '아니에요', '보통이에요', '그래요', '매우 그래요'];
begin
  -- 1. 로그인한 학생 또는 승인된 단체만
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- 회원정보 행을 잠근다: 같은 사람의 등록이 동시에 와도 하나씩 처리돼 잔액이 음수가 되지 않는다
  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'not_authenticated';
  end if;

  if v_profile.account_type = 'org' then
    if v_profile.approval_status <> 'approved' then
      raise exception 'org_not_approved';
    end if;
  elsif v_profile.account_type <> 'student' then
    raise exception 'not_allowed';
  end if;

  -- 2. 같은 요청이 이미 처리됐으면 그 설문 번호만 돌려준다 (비용 다시 안 뺌)
  if p_request_id is null then
    raise exception 'invalid_request';
  end if;
  select id into v_existing from public.surveys where owner_id = v_uid and request_id = p_request_id;
  if v_existing is not null then
    return v_existing;
  end if;

  -- 3. 기본 정보 검사
  if char_length(v_title) < 2 or char_length(v_title) > 60 then
    raise exception 'invalid_title';
  end if;
  if v_description is not null and char_length(v_description) > 500 then
    raise exception 'invalid_description';
  end if;
  if not exists (select 1 from public.survey_categories where id = p_category_id) then
    raise exception 'invalid_category';
  end if;
  if coalesce(p_audience, '') not in ('all', 'campus')
     or (p_audience = 'campus' and v_profile.university_id is null) then
    raise exception 'invalid_audience';
  end if;
  if p_target is null
     or p_target < public.point_rule('survey_min_target')
     or p_target > public.point_rule('survey_max_target') then
    raise exception 'invalid_target';
  end if;
  if p_days is null or p_days < 1 or p_days > public.point_rule('survey_max_days') then
    raise exception 'invalid_days';
  end if;

  if coalesce(p_result_visibility, '') not in ('public', 'campus', 'private')
     or (p_result_visibility = 'campus' and v_profile.university_id is null) then
    raise exception 'invalid_visibility';
  end if;

  -- 4. 문항 검사 + 예상 시간 합산
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' then
    raise exception 'invalid_questions';
  end if;
  v_count := jsonb_array_length(p_questions);
  if v_count < 1 or v_count > public.point_rule('survey_max_questions') then
    raise exception 'invalid_questions';
  end if;
  v_max_options := public.point_rule('survey_max_options');

  for v_q in select * from jsonb_array_elements(p_questions) loop
    v_type := v_q ->> 'type';
    if coalesce(v_type, '') not in ('single', 'multi', 'scale', 'text')
       or char_length(btrim(coalesce(v_q ->> 'text', ''))) not between 1 and 200 then
      raise exception 'invalid_questions';
    end if;

    -- 문항 옵션: 필수 끄기는 모든 종류 (2026-11-14), 긴 주관식 표시는 주관식만, 섞기·해당 없음·기타는 고르기 문항만
    perform public.question_flag(v_q, 'required', true);
    if (v_q ? 'long') and jsonb_typeof(v_q -> 'long') <> 'null' and v_type <> 'text' then
      raise exception 'invalid_questions';
    end if;
    perform public.question_flag(v_q, 'long', true);
    -- 문항 사진 1장 (2026-11-22): 내 폴더 surveys/<내 id>/ 에 올린 사진만
    if (v_q ? 'image') and jsonb_typeof(v_q -> 'image') <> 'null' then
      v_img := v_q ->> 'image';
      if jsonb_typeof(v_q -> 'image') <> 'string'
         or v_img not like 'surveys/' || v_uid::text || '/%' or char_length(v_img) > 200 then
        raise exception 'invalid_image';
      end if;
    end if;
    if (public.question_flag(v_q, 'shuffle', false)
        or public.question_flag(v_q, 'none', false)
        or public.question_flag(v_q, 'other', false))
       and v_type not in ('single', 'multi') then
      raise exception 'invalid_questions';
    end if;

    if v_type in ('single', 'multi') then
      if jsonb_typeof(v_q -> 'options') is distinct from 'array' then
        raise exception 'invalid_questions';
      end if;
      v_option_count := jsonb_array_length(v_q -> 'options');
      if v_option_count < 2 or v_option_count > v_max_options then
        raise exception 'invalid_questions';
      end if;
      for v_option in select * from jsonb_array_elements(v_q -> 'options') loop
        if jsonb_typeof(v_option) <> 'string'
           or char_length(btrim(v_option #>> '{}')) not between 1 and 100 then
          raise exception 'invalid_questions';
        end if;
      end loop;
    end if;

    if v_type = 'text' then
      v_seconds := v_seconds + public.point_rule('sec_per_text');
    else
      v_seconds := v_seconds + public.point_rule('sec_per_choice');
    end if;
  end loop;

  -- 5. 소요시간·보상·비용 (모두 서버가 정한다)
  v_est_minutes := greatest(1, ceil(v_seconds / 60.0)::integer);
  v_reward := public.calc_survey_reward(v_count, v_est_minutes);

  if v_profile.account_type = 'org' then
    -- TODO(임시): 단체는 테스트 동안 무료 (cost_survey_create_org) · Q14 답이 오면 변경
    v_price := 0;
    v_cost := public.point_rule('cost_survey_create_org');
  else
    v_price := public.calc_survey_price(v_count, v_est_minutes);
    v_cost := v_price * p_target;
  end if;

  select coalesce(sum(amount), 0)::integer into v_balance
    from public.point_ledger
   where user_id = v_uid and status = 'confirmed';
  if v_cost > 0 and v_balance < v_cost then
    raise exception 'insufficient_points';
  end if;

  -- 6. 설문 저장
  insert into public.surveys (
    owner_id, category_id, title, description, question_count, est_minutes, reward_points,
    target_responses, audience, university_id, closes_at, request_id, price_per_response,
    result_visibility, result_university_id
  ) values (
    v_uid, p_category_id, v_title, v_description, v_count, v_est_minutes, v_reward,
    p_target, p_audience,
    case when p_audience = 'campus' then v_profile.university_id end,
    now() + make_interval(days => p_days), p_request_id, v_price,
    p_result_visibility, case when p_result_visibility = 'campus' then v_profile.university_id end
  )
  returning id into v_survey_id;

  -- 주의 문항 위치: 문항이 기준 이상이면 가운데쯤에 1개 (문항 수·보상 계산에는 안 넣는다)
  if v_count >= public.point_rule('attention_min_questions') then
    v_attention_at := v_count / 2;
  end if;

  -- 7. 문항·선택지 저장
  v_i := 0;
  for v_q in select * from jsonb_array_elements(p_questions) loop
    v_i := v_i + 1;
    v_order := v_order + 1;
    v_type := v_q ->> 'type';

    insert into public.questions (survey_id, sort_order, type, text, is_required, shuffle_options, long_text, image_path)
    values (v_survey_id, v_order, v_type, btrim(v_q ->> 'text'),
            public.question_flag(v_q, 'required', true), public.question_flag(v_q, 'shuffle', false),
            public.question_flag(v_q, 'long', true), nullif(v_q ->> 'image', ''))
    returning id into v_question_id;

    if v_type in ('single', 'multi') then
      insert into public.question_options (question_id, sort_order, text)
      select v_question_id, o.ord, btrim(o.value #>> '{}')
        from jsonb_array_elements(v_q -> 'options') with ordinality as o(value, ord);

      -- 해당 없음·기타는 일반 보기 뒤에 (문구는 서버가 정한다)
      v_option_count := jsonb_array_length(v_q -> 'options');
      if public.question_flag(v_q, 'none', false) then
        insert into public.question_options (question_id, sort_order, text, kind)
        values (v_question_id, v_option_count + 1, '해당 없음', 'none');
      end if;
      if public.question_flag(v_q, 'other', false) then
        insert into public.question_options (question_id, sort_order, text, kind)
        values (v_question_id, v_option_count + 2, '기타 (직접 입력)', 'other');
      end if;
    end if;

    -- 주의 문항: 정답을 무작위로 골라 문구에 넣는다 (매번 같은 답이면 외워서 통과할 수 있음)
    if v_i = v_attention_at then
      v_order := v_order + 1;
      v_pick := 1 + floor(random() * 5)::integer;

      insert into public.questions (survey_id, sort_order, type, text, is_attention_check)
      values (
        v_survey_id, v_order, 'single',
        format('성실한 응답 확인용 문항이에요. ''%s''를 골라 주세요.', v_scale_labels[v_pick]),
        true
      )
      returning id into v_question_id;

      insert into public.question_options (question_id, sort_order, text)
      select v_question_id, l.ord, l.label
        from unnest(v_scale_labels) with ordinality as l(label, ord);

      select id into v_correct
        from public.question_options
       where question_id = v_question_id and sort_order = v_pick;

      update public.questions set correct_option_id = v_correct where id = v_question_id;
    end if;
  end loop;

  -- 8. 비용 차감 (고유 제약으로 설문당 1번)
  if v_cost > 0 then
    insert into public.point_ledger (user_id, amount, status, reason, ref_id)
    values (v_uid, -v_cost, 'confirmed', 'survey_create', v_survey_id::text);
  end if;

  return v_survey_id;
end;
$$;

-- =========================================================
-- 4. 결과 화면용 문항 사진 [{id, image}] (사진이 있는 문항만)
--    숨겨진 설문은 주지 않는다. 사진은 원래 공개 저장소라 그 외 조건은 두지 않는다
-- =========================================================
create function public.get_question_images(p_survey_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'image', q.image_path) order by q.sort_order), '[]'::jsonb)
    from public.questions q
    join public.surveys s on s.id = q.survey_id
   where q.survey_id = p_survey_id
     and q.image_path is not null
     and s.moderation = 'visible'
     and auth.uid() is not null;
$$;

revoke execute on function public.get_question_images(bigint) from public, anon;
grant execute on function public.get_question_images(bigint) to authenticated;

-- 확인: true 3개면 성공
select exists (select 1 from information_schema.columns where table_name = 'questions' and column_name = 'image_path') as 사진칸,
       (select count(*) from pg_policies where tablename = 'objects' and policyname like '공개 사진: 설문 사진%') = 2 as 저장소권한,
       exists (select 1 from pg_proc where proname = 'get_question_images') as 결과함수;
