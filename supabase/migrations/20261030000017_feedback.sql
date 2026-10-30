-- 의견 보내기 (2026-10-30) · 비공개 테스트 피드백 수집
--
-- 회원이 버그·불편·제안을 보내고, 운영자가 Table Editor에서 답변(reply)과 상태(status)를 단다.
-- 보낸 사람은 앱의 "내가 보낸 의견"에서 답변을 본다. 포인트 보상은 없다.
-- 함께 저장: 어느 화면에서 보냈는지, 기기 종류·OS 버전·앱 버전 (버그 재현용, 개인정보 아님)
--
-- 운영자 처리 (Table Editor → feedback):
--   reply에 답변을 쓰고, status를 answered(답변함) 또는 done(반영함)으로, replied_at에 지금 시각

insert into public.point_rules (key, value, description) values
  ('feedback_daily_max', 10, '의견 보내기 하루 최대 건수 (도배 방지)');

create table public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  category text not null check (category in ('bug', 'inconvenience', 'idea', 'other')),
  body text not null check (char_length(body) between 1 and 1000),
  screen text check (char_length(screen) <= 100),
  device jsonb not null default '{}'::jsonb,
  -- pending 확인 전 / answered 답변함 / done 반영함
  status text not null default 'pending' check (status in ('pending', 'answered', 'done')),
  reply text check (char_length(reply) <= 1000),
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "본인 의견만 읽을 수 있다"
  on public.feedback for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.feedback from anon, authenticated;
grant select on public.feedback to authenticated;

-- 의견 보내기. 내용 1~1000자, 하루 최대 feedback_daily_max건
create function public.send_feedback(p_category text, p_body text, p_screen text default null, p_device jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_category is null or p_category not in ('bug', 'inconvenience', 'idea', 'other') then
    raise exception 'invalid_feedback';
  end if;
  if char_length(v_body) not between 1 and 1000 then
    raise exception 'invalid_feedback';
  end if;

  -- 같은 사람이 동시에 여러 번 보내도 하루 건수를 넘지 않게 회원정보 행을 잠근다
  perform 1 from public.profiles where id = v_uid for update;
  if (select count(*) from public.feedback
       where user_id = v_uid and created_at > now() - interval '1 day')
     >= public.point_rule('feedback_daily_max') then
    raise exception 'feedback_limit';
  end if;

  insert into public.feedback (user_id, category, body, screen, device)
  values (v_uid, p_category, v_body, left(p_screen, 100),
          case when jsonb_typeof(p_device) = 'object' then p_device else '{}'::jsonb end)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.send_feedback(text, text, text, jsonb) from public, anon;
grant execute on function public.send_feedback(text, text, text, jsonb) to authenticated;
