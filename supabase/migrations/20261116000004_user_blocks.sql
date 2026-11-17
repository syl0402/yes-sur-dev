-- 2026-11-16 커뮤니티 ④ 사용자 차단 (Play 사용자 제작 콘텐츠 정책 대비, 11/21 2주차 업데이트)
-- · 글·댓글의 ⋯ → [이 사람 차단] → 그 사람의 글·댓글이 나한테 안 보인다 (피드·글·댓글은 20261116000003에서 이미 걸러 냄)
-- · 익명이라 누구인지 드러내지 않는다: 앱에는 상대 id를 주지 않고, 차단 목록에는 "차단할 때 본 글/댓글 앞부분"만 보여 준다
-- · 상대에게 알리지 않는다 · 내 정보 → 차단한 사용자에서 해제
-- · 나 자신·탈퇴한 회원·운영자(옛썰 공식)는 차단할 수 없다

alter table public.user_blocks add column id bigint generated always as identity unique;
alter table public.user_blocks add column context text check (char_length(context) <= 60);

-- 글(post)이나 댓글(comment)을 보고 그 작성자를 차단
create function public.block_author(p_type text, p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_author uuid;
  v_context text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_type = 'post' then
    select author_id, left(question, 40) into v_author, v_context from public.posts where id = p_id;
  elsif p_type = 'comment' then
    select author_id, left(body, 40) into v_author, v_context from public.comments where id = p_id;
  else
    raise exception 'cannot_block';
  end if;
  if v_author is null or v_author = v_uid
     or exists (select 1 from public.profiles where id = v_author and role = 'admin') then
    raise exception 'cannot_block';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id, context)
  values (v_uid, v_author, v_context)
  on conflict (blocker_id, blocked_id) do nothing;
end;
$$;

-- 내 차단 목록 [{id, context, created_at}] (상대가 누구인지는 주지 않는다)
create function public.get_my_blocks()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'context', context, 'created_at', created_at)
                            order by created_at desc), '[]'::jsonb)
    from public.user_blocks
   where blocker_id = auth.uid();
$$;

-- 차단 해제 (내 차단만)
create function public.unblock(p_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.user_blocks where id = p_id and blocker_id = auth.uid();
$$;

revoke execute on function public.block_author(text, bigint) from public, anon;
revoke execute on function public.get_my_blocks() from public, anon;
revoke execute on function public.unblock(bigint) from public, anon;
grant execute on function public.block_author(text, bigint) to authenticated;
grant execute on function public.get_my_blocks() to authenticated;
grant execute on function public.unblock(bigint) to authenticated;
