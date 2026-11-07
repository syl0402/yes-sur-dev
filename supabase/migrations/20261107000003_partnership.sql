-- 제휴·광고 문의 (2026-11-07 팀 피드백 5, 푸망 문의 폼 참고)
--
-- 주로 단체 계정이 보낸다. 운영자가 담당자에게 전화·메일로 답하므로 담당자 정보를 받는다 (수집 동의 필수).
-- 의견 보내기(feedback)와 따로 둔다: 담당자 연락처를 의견 표에 섞지 않고, 보관 기간도 따로 (접수 후 1년)
--   1. partnership_inquiries 표
--   2. send_partnership_inquiry()
--   3. 오래된 개인정보 지우기 함수 purge_expired_personal_data() (매일 실행은 20261107000005에서)
--
-- 운영자 처리 (Table Editor → partnership_inquiries): 담당자에게 연락한 뒤 status를 answered 또는 done으로

insert into public.point_rules (key, value, description) values
  ('partnership_keep_days', 365, '제휴·광고 문의 보관 일수 (지나면 자동 삭제, 개인정보처리방침과 같게)');

-- =========================================================
-- 1. 표
-- =========================================================
create table public.partnership_inquiries (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  contact_name text not null check (char_length(contact_name) between 1 and 30),
  company text not null check (char_length(company) between 1 and 50),
  job_title text check (char_length(job_title) <= 30),
  -- 휴대폰 번호 숫자만 (01012345678)
  phone text not null check (phone ~ '^01[016789][0-9]{7,8}$'),
  email text not null check (char_length(email) <= 100 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- 옛썰을 알게 된 경로 (선택)
  source text check (source in ('friend', 'sns', 'search', 'school', 'other')),
  brand text not null check (char_length(brand) between 1 and 50),
  body text not null check (char_length(body) between 1 and 1000),
  consented_at timestamptz not null,
  -- pending 확인 전 / answered 연락함 / done 처리 끝
  status text not null default 'pending' check (status in ('pending', 'answered', 'done')),
  created_at timestamptz not null default now()
);

alter table public.partnership_inquiries enable row level security;

create policy "본인 문의만 읽을 수 있다"
  on public.partnership_inquiries for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.partnership_inquiries from anon, authenticated;
grant select on public.partnership_inquiries to authenticated;

-- =========================================================
-- 2. 문의 보내기. 개인정보 수집 동의 필수, 하루 최대 feedback_daily_max건 (의견 보내기와 같은 한도)
-- =========================================================
create function public.send_partnership_inquiry(
  p_contact_name text,
  p_company text,
  p_job_title text,
  p_phone text,
  p_email text,
  p_source text,
  p_brand text,
  p_body text,
  p_consent boolean
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_consent is not true then
    raise exception 'consent_required';
  end if;
  if v_phone !~ '^01[016789][0-9]{7,8}$' then
    raise exception 'invalid_phone';
  end if;
  if btrim(coalesce(p_email, '')) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email';
  end if;
  if char_length(btrim(coalesce(p_contact_name, ''))) not between 1 and 30
     or char_length(btrim(coalesce(p_company, ''))) not between 1 and 50
     or char_length(btrim(coalesce(p_job_title, ''))) > 30
     or char_length(btrim(coalesce(p_brand, ''))) not between 1 and 50
     or char_length(btrim(coalesce(p_body, ''))) not between 1 and 1000
     or (p_source is not null and p_source not in ('friend', 'sns', 'search', 'school', 'other')) then
    raise exception 'invalid_inquiry';
  end if;

  -- 같은 사람이 동시에 여러 번 보내도 하루 건수를 넘지 않게 회원정보 행을 잠근다
  perform 1 from public.profiles where id = v_uid for update;
  if (select count(*) from public.partnership_inquiries
       where user_id = v_uid and created_at > now() - interval '1 day')
     >= public.point_rule('feedback_daily_max') then
    raise exception 'feedback_limit';
  end if;

  insert into public.partnership_inquiries
    (user_id, contact_name, company, job_title, phone, email, source, brand, body, consented_at)
  values
    (v_uid, btrim(p_contact_name), btrim(p_company), nullif(btrim(coalesce(p_job_title, '')), ''), v_phone,
     btrim(p_email), p_source, btrim(p_brand), btrim(p_body), now())
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.send_partnership_inquiry(text, text, text, text, text, text, text, text, boolean)
  from public, anon;
grant execute on function public.send_partnership_inquiry(text, text, text, text, text, text, text, text, boolean)
  to authenticated;

-- =========================================================
-- 3. 보관 기간이 지난 개인정보 지우기 (매일 한 번. 보상 연락처는 20261107000004에서 이 함수에 더한다)
-- =========================================================
create function public.purge_expired_personal_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.partnership_inquiries
   where created_at < now() - make_interval(days => public.point_rule('partnership_keep_days')::integer);
end;
$$;

revoke execute on function public.purge_expired_personal_data() from public, anon, authenticated;
