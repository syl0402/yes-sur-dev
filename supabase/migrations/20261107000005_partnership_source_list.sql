-- 제휴·광고 문의: 알게 된 경로 선택지 다시 정하기 (2026-11-07)
-- 처음 알게 된 곳: 앱 마켓(플레이스토어) 추가 · 대학생 커뮤니티(에브리타임) 따로
-- store 앱 마켓(지금은 플레이스토어. 아이폰 출시하면 화면 이름만 바꿈) · friend 지인 소개 · sns SNS · community 에브리타임·커뮤니티 · search 검색 · school 학교·학생회 · other 기타
-- 20261107000004 다음에 실행

alter table public.partnership_inquiries drop constraint partnership_inquiries_source_check;
alter table public.partnership_inquiries add constraint partnership_inquiries_source_check
  check (source in ('store', 'friend', 'sns', 'community', 'search', 'school', 'other'));

create or replace function public.send_partnership_inquiry(
  p_contact_name text,
  p_company text,
  p_job_title text,
  p_phone text,
  p_email text,
  p_source text,
  p_source_etc text,
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
  v_etc text := nullif(btrim(coalesce(p_source_etc, '')), '');
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
  -- 알게 된 경로는 필수, "기타"면 직접 쓴 내용도 필수
  if p_source is null or p_source not in ('store', 'friend', 'sns', 'community', 'search', 'school', 'other')
     or (p_source = 'other' and v_etc is null)
     or char_length(coalesce(v_etc, '')) > 50 then
    raise exception 'invalid_source';
  end if;
  if char_length(btrim(coalesce(p_contact_name, ''))) not between 1 and 30
     or char_length(btrim(coalesce(p_company, ''))) not between 1 and 50
     or char_length(btrim(coalesce(p_job_title, ''))) > 30
     or char_length(btrim(coalesce(p_brand, ''))) not between 1 and 50
     or char_length(btrim(coalesce(p_body, ''))) not between 1 and 1000 then
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
    (user_id, contact_name, company, job_title, phone, email, source, source_etc, brand, body, consented_at)
  values
    (v_uid, btrim(p_contact_name), btrim(p_company), nullif(btrim(coalesce(p_job_title, '')), ''), v_phone,
     btrim(p_email), p_source, case when p_source = 'other' then v_etc end, btrim(p_brand), btrim(p_body), now())
  returning id into v_id;
  return v_id;
end;
$$;
