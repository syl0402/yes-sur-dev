-- 설문 삭제 조건을 "정상 응답 0명"으로 (2026-11-10, 20261110000002 보완)
-- 확인 문항을 틀린 응답(rejected)만 있는 설문이 화면에는 응답 0명인데 삭제가 막혔다.
-- 틀린 응답자는 포인트를 받지 않았고 결과에도 들어가지 않으므로, 정상 응답(confirmed)만 센다.
-- 바뀐 곳은 응답 확인 한 줄뿐 (나머지는 20261110000002와 같음)

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
  -- 정상 응답만 센다. 확인 문항을 틀린 응답(rejected)은 함께 지워진다
  if exists (select 1 from public.responses where survey_id = p_survey_id and status = 'confirmed') then
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
