-- 응답 0명 설문 삭제 + 등록비 환불 (2026-11-10 개인 피드백 6번)
-- 잘못 만든 설문이 쌓이지 않게, 응답이 하나도 없을 때만 작성자가 지울 수 있다.
-- 응답이 생긴 뒤에는 지금처럼 마감(close_survey)만 가능 (응답자 보상·데이터 탭 결과 보호).
-- 앱의 "처음부터 다시 고치기"도 이 함수로 지운 뒤 같은 내용을 작성 화면에 채운다.

-- 1. 포인트 기록 이유에 survey_delete(설문 삭제 환불) 추가 (20261030000025 목록 + 1)
alter table public.point_ledger drop constraint point_ledger_reason_check;
alter table public.point_ledger add constraint point_ledger_reason_check
  check (reason in ('welcome', 'survey_reward', 'survey_create', 'survey_refund', 'survey_delete',
                    'data_view', 'data_share', 'balance_vote', 'daily_question', 'streak_bonus',
                    'community', 'creator_bonus', 'invite'));

-- 2. delete_survey: 확인 → 환불 → 삭제를 한 번에. 돌려준 포인트를 돌려준다 (0이면 0)
--   - 환불액 = 이 설문 등록비(survey_create) - 이미 돌려받은 것(일찍 마감 환불 survey_refund)
--     금액을 다시 계산하지 않고 포인트 기록에서 읽는다
--   - 중복 방지: 설문 행을 잠그고 같은 트랜잭션에서 지우므로 두 번째 요청은 survey_not_found.
--     고유 제약 (user_id, reason, ref_id)도 한 번 더 막는다
--   - 문항·보기·태그·보상 연락처·커뮤니티 홍보 글은 설문과 함께 지워진다 (on delete cascade)
create or replace function public.delete_survey(p_survey_id bigint)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_survey public.surveys%rowtype;
  v_paid integer;
  v_refunded integer;
  v_refund integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- 응답 제출과 동시에 와도 순서대로 처리되게 설문 행을 잠근다
  select * into v_survey from public.surveys where id = p_survey_id for update;
  if not found then
    raise exception 'survey_not_found';
  end if;
  if v_survey.owner_id <> v_uid then
    raise exception 'not_owner';
  end if;
  -- 확인 문항을 틀린 응답(rejected)도 응답으로 친다
  if exists (select 1 from public.responses where survey_id = p_survey_id) then
    raise exception 'survey_has_responses';
  end if;

  select coalesce(-sum(amount), 0) into v_paid
    from public.point_ledger
   where user_id = v_uid and reason = 'survey_create' and ref_id = p_survey_id::text and status = 'confirmed';
  select coalesce(sum(amount), 0) into v_refunded
    from public.point_ledger
   where user_id = v_uid and reason = 'survey_refund' and ref_id = p_survey_id::text and status = 'confirmed';
  v_refund := greatest(v_paid - v_refunded, 0);

  if v_refund > 0 then
    insert into public.point_ledger (user_id, amount, status, reason, ref_id)
    values (v_uid, v_refund, 'confirmed', 'survey_delete', p_survey_id::text);
  end if;

  delete from public.surveys where id = p_survey_id;

  return v_refund;
end;
$$;

revoke all on function public.delete_survey(bigint) from public, anon;
grant execute on function public.delete_survey(bigint) to authenticated;

-- 3. get_survey_for_copy: "처음부터 다시 고치기"용으로 내 설문 문항·보기를 돌려준다
--   확인 문항은 앱이 구분할 수 없어서(is_attention_check 칸은 앱에서 못 읽음) 서버가 빼고 보낸다
--   모양: [{ "type": "single", "text": "…", "options": ["…", "…"] }, …] (문항 순서대로)
create or replace function public.get_survey_for_copy(p_survey_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select owner_id into v_owner from public.surveys where id = p_survey_id;
  if not found then
    raise exception 'survey_not_found';
  end if;
  if v_owner <> v_uid then
    raise exception 'not_owner';
  end if;

  return coalesce((
    select jsonb_agg(
             jsonb_build_object(
               'type', q.type,
               'text', q.text,
               'options', coalesce((select jsonb_agg(o.text order by o.sort_order)
                                      from public.question_options o where o.question_id = q.id), '[]'::jsonb)
             )
             order by q.sort_order)
      from public.questions q
     where q.survey_id = p_survey_id and not q.is_attention_check
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_survey_for_copy(bigint) from public, anon;
grant execute on function public.get_survey_for_copy(bigint) to authenticated;
