-- 2026-11-14 커뮤니티 시안 ③ 글쓰기: 골라 줘 보기 최대 4개 → 5개
-- create_post에서 pick 보기 수만 2~5로 (나머지는 20261103000002와 같음)

create or replace function public.create_post(p_kind text, p_question text, p_options text[] default null, p_body text default null,
                                   p_anonymous boolean default true)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_question text := btrim(coalesce(p_question, ''));
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_options text[];
  v_opt text;
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_kind is null or p_kind not in ('balance', 'relate', 'pick') then
    raise exception 'invalid_post';
  end if;
  if char_length(v_question) not between 1 and 100 or char_length(coalesce(v_body, '')) > 500 then
    raise exception 'invalid_post';
  end if;

  if p_kind = 'relate' then
    v_options := array['나도 그래', '나는 아냐'];
  else
    v_options := '{}';
    foreach v_opt in array coalesce(p_options, '{}') loop
      v_opt := btrim(coalesce(v_opt, ''));
      if char_length(v_opt) not between 1 and 30 then
        raise exception 'invalid_post';
      end if;
      if v_opt = any (v_options) then
        raise exception 'invalid_post';
      end if;
      v_options := v_options || v_opt;
    end loop;
    if (p_kind = 'balance' and cardinality(v_options) <> 2)
       or (p_kind = 'pick' and cardinality(v_options) not between 2 and 5) then
      raise exception 'invalid_post';
    end if;
  end if;

  perform 1 from public.profiles where id = v_uid for update;
  if (select count(*) from public.posts where author_id = v_uid and created_at >= public.kst_day_start())
     >= public.point_rule('post_daily_max') then
    raise exception 'post_limit';
  end if;

  insert into public.posts (author_id, kind, question, options, body, anonymous)
  values (v_uid, p_kind, v_question, v_options, v_body,
          coalesce(p_anonymous, true) and public.can_post_anonymously(v_uid))
  returning id into v_id;
  return v_id;
end;
$$;
