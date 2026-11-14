-- 2026-11-14 마이 탭 시안 ⑨: 의견 보내기에 화면 캡처 1장 첨부
-- 1. 사진 저장소 feedback (비공개, 3MB까지, jpg·png·webp)
--    경로: <내 회원 id>/<임의 이름>.jpg — 본인 폴더에만 올리고 읽을 수 있다. 운영자(is_admin)는 모두 읽을 수 있다
-- 2. feedback.image_path 칸
-- 3. send_feedback에 p_image (선택) — 본인 폴더 경로만 받는다
-- 4. admin_get_feedback이 image_path도 보낸다 (운영자 화면에서 캡처 보기)

-- 1. 저장소
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback', 'feedback', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "의견 캡처: 본인 폴더에만 올린다"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'feedback' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "의견 캡처: 본인 것과 운영자만 본다"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'feedback' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));

-- 2. 사진 칸
alter table public.feedback add column image_path text check (char_length(image_path) <= 200);

-- 3. 의견 보내기 (사진 경로 추가. 나머지는 20261030000017과 같음)
drop function public.send_feedback(text, text, text, jsonb);
create function public.send_feedback(p_category text, p_body text, p_screen text default null, p_device jsonb default '{}'::jsonb,
                                     p_image text default null)
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
  -- 사진은 내 폴더 경로만 (남의 파일을 붙일 수 없게)
  if p_image is not null and (p_image not like v_uid::text || '/%' or char_length(p_image) > 200) then
    raise exception 'invalid_feedback';
  end if;

  -- 같은 사람이 동시에 여러 번 보내도 하루 건수를 넘지 않게 회원정보 행을 잠근다
  perform 1 from public.profiles where id = v_uid for update;
  if (select count(*) from public.feedback
       where user_id = v_uid and created_at > now() - interval '1 day')
     >= public.point_rule('feedback_daily_max') then
    raise exception 'feedback_limit';
  end if;

  insert into public.feedback (user_id, category, body, screen, device, image_path)
  values (v_uid, p_category, v_body, left(p_screen, 100),
          case when jsonb_typeof(p_device) = 'object' then p_device else '{}'::jsonb end,
          p_image)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.send_feedback(text, text, text, jsonb, text) from public, anon;
grant execute on function public.send_feedback(text, text, text, jsonb, text) to authenticated;

-- 4. 운영자 의견 목록 (image_path 추가. 나머지는 20261031000003과 같음)
create or replace function public.admin_get_feedback()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', id, 'category', category, 'body', body, 'screen', screen,
             'device', device, 'image_path', image_path, 'created_at', created_at
           )
           order by created_at
         ), '[]'::jsonb)
    into v_result
    from public.feedback
   where status = 'pending';

  return v_result;
end;
$$;
