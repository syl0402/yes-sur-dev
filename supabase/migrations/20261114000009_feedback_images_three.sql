-- 2026-11-14 의견 캡처 1장 → 최대 3장 (사용자 결정)
-- 20261114000008 다음에 실행. feedback.image_paths(목록) 칸을 더하고, send_feedback은 p_images(최대 3개)를 받는다
-- 예전 image_path(1장) 칸은 남겨 두고, 운영자 목록에서는 둘을 합쳐 image_paths로 보낸다

alter table public.feedback add column image_paths text[] not null default '{}'
  check (cardinality(image_paths) <= 3);

drop function public.send_feedback(text, text, text, jsonb, text);
create function public.send_feedback(p_category text, p_body text, p_screen text default null, p_device jsonb default '{}'::jsonb,
                                     p_images text[] default '{}')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_images text[] := coalesce(p_images, '{}');
  v_path text;
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
  -- 사진은 3장까지, 내 폴더 경로만 (남의 파일을 붙일 수 없게)
  if cardinality(v_images) > 3 then
    raise exception 'invalid_feedback';
  end if;
  foreach v_path in array v_images loop
    if v_path is null or v_path not like v_uid::text || '/%' or char_length(v_path) > 200 then
      raise exception 'invalid_feedback';
    end if;
  end loop;

  -- 같은 사람이 동시에 여러 번 보내도 하루 건수를 넘지 않게 회원정보 행을 잠근다
  perform 1 from public.profiles where id = v_uid for update;
  if (select count(*) from public.feedback
       where user_id = v_uid and created_at > now() - interval '1 day')
     >= public.point_rule('feedback_daily_max') then
    raise exception 'feedback_limit';
  end if;

  insert into public.feedback (user_id, category, body, screen, device, image_paths)
  values (v_uid, p_category, v_body, left(p_screen, 100),
          case when jsonb_typeof(p_device) = 'object' then p_device else '{}'::jsonb end,
          v_images)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.send_feedback(text, text, text, jsonb, text[]) from public, anon;
grant execute on function public.send_feedback(text, text, text, jsonb, text[]) to authenticated;

-- 운영자 의견 목록: 사진 경로 목록 (예전 1장 칸도 합침)
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
             'device', device,
             'image_paths', case when image_path is not null then array_prepend(image_path, image_paths) else image_paths end,
             'created_at', created_at
           )
           order by created_at
         ), '[]'::jsonb)
    into v_result
    from public.feedback
   where status = 'pending';

  return v_result;
end;
$$;
