-- 2026-11-15 운영자 화면 "전체 알림 보내기": 알림을 켠 모든 사용자에게 공지 푸시 (폰으로 운영)
-- 쓰는 곳: 11/21 2주차 업데이트 안내, 11/26 최종 피드백 설문 공지
-- · 운영자만 부를 수 있다 (is_admin 아니면 거부)
-- · 하루 한 번만: notifications의 (user_id, kind, day) 고유 제약으로 연타·재시도해도 같은 날 두 번 가지 않는다
-- · 글자 수: 제목 30자, 내용 100자 (폰 알림에서 잘리지 않게)
-- · 누르면 갈 화면은 정해 둔 4곳만 (홈·미션·설문·커뮤니티)
-- TODO(임시): 안드로이드 알림 채널은 기존 'mission'(웰컴 미션)을 같이 쓴다 · 정식 출시 빌드 때 '공지' 채널을 새로 만들어 나누기 · 새 채널은 앱 빌드가 필요해서 (2026-11-15)

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('daily', 'mission', 'notice'));

-- 보낼 대상 수 (확인 창 "n명에게 보낼까요?")
create function public.admin_notice_target_count()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  return (select count(distinct user_id) from public.push_tokens);
end;
$$;

-- 돌려주는 값: 보낸 기기 수. 오늘 이미 보냈으면 already_sent_today
create function public.admin_send_notice(p_title text, p_body text, p_url text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_msgs jsonb;
  v_batch jsonb;
  v_sent integer := 0;
  v_size constant integer := 100;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  if char_length(v_title) not between 1 and 30 or char_length(v_body) not between 1 and 100 then
    raise exception 'invalid_notice';
  end if;
  if p_url is not null and p_url not in ('/home', '/missions', '/surveys', '/community') then
    raise exception 'invalid_notice';
  end if;
  if exists (select 1 from public.notifications where kind = 'notice' and day = v_day) then
    raise exception 'already_sent_today';
  end if;

  with targets as (
    select distinct user_id from public.push_tokens
  ),
  logged as (
    insert into public.notifications (user_id, kind, day, title, body, url)
    select user_id, 'notice', v_day, v_title, v_body, p_url
      from targets
    on conflict (user_id, kind, day) do nothing
    returning user_id, title, body, url
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'to', t.token,
           'title', l.title,
           'body', l.body,
           'sound', 'default',
           'channelId', 'mission',
           'data', jsonb_build_object('url', l.url)
         )), '[]'::jsonb)
    into v_msgs
    from logged l
    join public.push_tokens t on t.user_id = l.user_id;

  for i in 0 .. greatest(jsonb_array_length(v_msgs) - 1, 0) / v_size loop
    select jsonb_agg(e) into v_batch
      from jsonb_array_elements(v_msgs) with ordinality as x (e, n)
     where n > i * v_size and n <= (i + 1) * v_size;
    exit when v_batch is null;
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_batch,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
    v_sent := v_sent + jsonb_array_length(v_batch);
  end loop;

  return v_sent;
end;
$$;

revoke execute on function public.admin_notice_target_count() from public, anon;
revoke execute on function public.admin_send_notice(text, text, text) from public, anon;
grant execute on function public.admin_notice_target_count() to authenticated;
grant execute on function public.admin_send_notice(text, text, text) to authenticated;
