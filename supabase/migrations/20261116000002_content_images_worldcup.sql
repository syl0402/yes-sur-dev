-- 2026-11-16 사진 기능 0+1단계: 공개 사진 저장소 content + 월드컵 후보 사진 (운영자만 올림)
-- 1. 저장소 content (공개: 누구나 주소로 볼 수 있음, 3MB까지, jpg·png·webp)
--    폴더별로 올릴 수 있는 사람을 나눈다. worldcup/ = 운영자만. (질문 사진 questions/ 는 C단계에서 따로 정함)
--    의견 캡처(feedback)는 지금처럼 비공개 저장소 그대로
-- 2. worldcup_candidates.image_path (없으면 지금처럼 글자만)
-- 3. 함수
--    get_worldcup_images: 월드컵 하나의 후보 사진 경로 (로그인한 사람)
--    admin_get_worldcup_candidates: 사진 올리기 화면용 월드컵·후보 목록 (운영자만)
--    admin_set_candidate_image: 후보 사진 바꾸기·지우기 (운영자만, worldcup/ 폴더 경로만)

-- 1. 저장소
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content', 'content', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "공개 사진: 월드컵 사진은 운영자만 올린다"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'content' and (storage.foldername(name))[1] = 'worldcup' and public.is_admin());

create policy "공개 사진: 월드컵 사진은 운영자만 지운다"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'content' and (storage.foldername(name))[1] = 'worldcup' and public.is_admin());

-- 2. 후보 사진 칸
alter table public.worldcup_candidates add column image_path text check (char_length(image_path) <= 200);

-- 3-1. 월드컵 하나의 후보 사진 [{id, image_path}] (사진 있는 후보만)
create function public.get_worldcup_images(p_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'image_path', c.image_path) order by c.sort_order), '[]'::jsonb)
    from public.worldcup_candidates c
   where c.worldcup_id = p_id and c.image_path is not null;
$$;

-- 3-2. 운영자: 월드컵·후보 목록 (사진 올리기 화면)
create function public.admin_get_worldcup_candidates()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', w.id,
             'title', w.title,
             'candidates', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'image_path', c.image_path)
                                                      order by c.sort_order), '[]'::jsonb)
                              from public.worldcup_candidates c where c.worldcup_id = w.id)
           ) order by w.created_at desc)
      from public.worldcups w
  ), '[]'::jsonb);
end;
$$;

-- 3-3. 운영자: 후보 사진 바꾸기 (p_path = null이면 사진 지우기)
create function public.admin_set_candidate_image(p_candidate_id bigint, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  if p_path is not null and (p_path not like 'worldcup/%' or char_length(p_path) > 200) then
    raise exception 'invalid_image';
  end if;
  update public.worldcup_candidates set image_path = p_path where id = p_candidate_id;
  if not found then
    raise exception 'candidate_not_found';
  end if;
end;
$$;

revoke execute on function public.get_worldcup_images(bigint) from public, anon;
revoke execute on function public.admin_get_worldcup_candidates() from public, anon;
revoke execute on function public.admin_set_candidate_image(bigint, text) from public, anon;
grant execute on function public.get_worldcup_images(bigint) to authenticated;
grant execute on function public.admin_get_worldcup_candidates() to authenticated;
grant execute on function public.admin_set_candidate_image(bigint, text) to authenticated;
