-- 커뮤니티 2-2: 금칙어 · 닉네임 변경 · 지난 오늘의 질문 (2026-10-30)
--
-- 금칙어: banned_words 표에 있는 말이 글(질문·본문·보기)·댓글·닉네임에 들어가면 저장을 막는다 (트리거).
--         scope = all(어디든) / nickname(닉네임만: "운영자"·"옛썰" 같은 사칭 방지). 운영자가 Table Editor로 추가
--         띄어쓰기를 빼고 대소문자 구분 없이 찾는다 ("시 발" → "시발")
-- 닉네임: 학생만, nickname_change_days일에 한 번 (신고 피해 다니기 방지). 단체는 단체 이름을 쓴다
-- 지난 오늘의 질문: 어제까지의 질문 최종 비율 · 계열 등 그룹별 차이 · 댓글. 늦게 봐도 출석 포인트는 없음

-- =========================================================
-- 1. 금칙어
-- =========================================================
create table public.banned_words (
  word text primary key check (char_length(word) between 1 and 30),
  scope text not null default 'all' check (scope in ('all', 'nickname')),
  created_at timestamptz not null default now()
);

alter table public.banned_words enable row level security;
revoke all on public.banned_words from anon, authenticated;

insert into public.banned_words (word, scope) values
  ('시발', 'all'), ('씨발', 'all'), ('ㅅㅂ', 'all'), ('병신', 'all'), ('ㅂㅅ', 'all'),
  ('개새끼', 'all'), ('좆', 'all'), ('fuck', 'all'),
  ('운영자', 'nickname'), ('관리자', 'nickname'), ('옛썰', 'nickname'), ('admin', 'nickname');

-- 금칙어가 들어 있나 (닉네임이면 nickname 범위까지)
create function public.has_banned_word(p_text text, p_nickname boolean default false)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.banned_words w
     where (w.scope = 'all' or p_nickname)
       and position(lower(w.word) in lower(replace(coalesce(p_text, ''), ' ', ''))) > 0
  );
$$;

revoke execute on function public.has_banned_word(text, boolean) from public, anon, authenticated;

-- 글: 질문 · 본문 · 보기
create function public.check_post_words()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.has_banned_word(new.question) or public.has_banned_word(new.body)
     or public.has_banned_word(array_to_string(new.options, ' ')) then
    raise exception 'banned_word';
  end if;
  return new;
end;
$$;

create trigger posts_check_words
  before insert or update of question, body, options on public.posts
  for each row execute function public.check_post_words();

-- 댓글
create function public.check_comment_words()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.has_banned_word(new.body) then
    raise exception 'banned_word';
  end if;
  return new;
end;
$$;

create trigger comments_check_words
  before insert or update of body on public.comments
  for each row execute function public.check_comment_words();

-- 닉네임 (가입할 때도, 바꿀 때도)
create function public.check_nickname_words()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.nickname is not null and public.has_banned_word(new.nickname, true) then
    raise exception 'banned_word';
  end if;
  return new;
end;
$$;

create trigger profiles_check_nickname
  before insert or update of nickname on public.profiles
  for each row execute function public.check_nickname_words();

revoke execute on function public.check_post_words() from public, anon, authenticated;
revoke execute on function public.check_comment_words() from public, anon, authenticated;
revoke execute on function public.check_nickname_words() from public, anon, authenticated;

-- =========================================================
-- 2. 닉네임 변경
-- =========================================================
insert into public.point_rules (key, value, description) values
  ('nickname_change_days', 30, '닉네임을 다시 바꿀 수 있기까지 걸리는 날');

alter table public.profiles add column nickname_changed_at timestamptz;

create function public.change_nickname(p_nickname text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_nickname text := btrim(coalesce(p_nickname, ''));
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_profile from public.profiles where id = v_uid for update;
  if v_profile.account_type <> 'student' then
    raise exception 'nickname_student_only';
  end if;
  if char_length(v_nickname) not between 2 and 12 then
    raise exception 'invalid_nickname';
  end if;
  if v_nickname = v_profile.nickname then
    return;
  end if;
  if v_profile.nickname_changed_at is not null
     and v_profile.nickname_changed_at > now() - make_interval(days => public.point_rule('nickname_change_days')::integer) then
    raise exception 'nickname_cooldown';
  end if;

  begin
    update public.profiles set nickname = v_nickname, nickname_changed_at = now() where id = v_uid;
  exception when unique_violation then
    raise exception 'nickname_taken';
  end;
end;
$$;

revoke execute on function public.change_nickname(text) from public, anon;
grant execute on function public.change_nickname(text) to authenticated;

-- =========================================================
-- 3. 지난 오늘의 질문
-- =========================================================

-- 오늘의 질문 답에도 그룹 저장 (투표·응답과 같은 방식)
alter table public.daily_answers
  add column grp_major text,
  add column grp_grade text,
  add column grp_gender text,
  add column grp_age text;

create trigger daily_answers_fill_groups
  before insert on public.daily_answers
  for each row execute function public.fill_response_groups();

update public.daily_answers
   set grp_major  = public.respondent_group('major', user_id),
       grp_grade  = public.respondent_group('grade', user_id),
       grp_gender = public.respondent_group('gender', user_id),
       grp_age    = public.respondent_group('age', user_id)
 where user_id is not null;

-- 그룹별 A·B 수. 인원이 result_min_count 미만이면 숫자 없이 숨김
create function public.daily_groups(p_question_id bigint, p_dim text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with v as (
    select coalesce(case p_dim
                      when 'major' then grp_major
                      when 'grade' then grp_grade
                      when 'gender' then grp_gender
                      else grp_age
                    end, '미입력') as grp,
           choice
      from public.daily_answers
     where question_id = p_question_id
  ),
  g as (
    select grp, count(*)::integer as n,
           count(*) filter (where choice = 'a')::integer as a,
           count(*) filter (where choice = 'b')::integer as b
      from v group by grp
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'label', grp,
             'hidden', n < public.point_rule('result_min_count'),
             'n', case when n < public.point_rule('result_min_count') then null else n end,
             'counts', case when n >= public.point_rule('result_min_count') then jsonb_build_array(a, b) end
           ) order by grp), '[]'::jsonb)
    from g;
$$;

revoke execute on function public.daily_groups(bigint, text) from public, anon, authenticated;

-- 어제까지의 질문 30개 (최근순): { id, day, question, option_a, option_b, a, b, my_choice, comment_count }
create function public.get_past_dailies()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  return (
    select coalesce(jsonb_agg(
             jsonb_build_object(
               'id', q.id, 'day', q.day, 'question', q.question, 'option_a', q.option_a, 'option_b', q.option_b,
               'a', (select count(*) from public.daily_answers a where a.question_id = q.id and a.choice = 'a'),
               'b', (select count(*) from public.daily_answers a where a.question_id = q.id and a.choice = 'b'),
               'my_choice', (select a.choice from public.daily_answers a where a.question_id = q.id and a.user_id = v_uid),
               'comment_count', (select count(*) from public.comments c
                                  where c.target_type = 'daily' and c.target_id = q.id and c.moderation = 'visible')
             ) order by q.day desc), '[]'::jsonb)
      from (select * from public.daily_questions
             where day < (now() at time zone 'Asia/Seoul')::date
             order by day desc limit 30) q
  );
end;
$$;

-- 지난 질문 하나 + 그룹별 차이 (오늘 질문은 홈에서)
create function public.get_past_daily(p_question_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_q public.daily_questions%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_q from public.daily_questions
   where id = p_question_id and day < (now() at time zone 'Asia/Seoul')::date;
  if not found then
    raise exception 'post_not_found';
  end if;
  return jsonb_build_object(
    'id', v_q.id, 'day', v_q.day, 'question', v_q.question, 'option_a', v_q.option_a, 'option_b', v_q.option_b,
    'a', (select count(*) from public.daily_answers a where a.question_id = v_q.id and a.choice = 'a'),
    'b', (select count(*) from public.daily_answers a where a.question_id = v_q.id and a.choice = 'b'),
    'my_choice', (select a.choice from public.daily_answers a where a.question_id = v_q.id and a.user_id = v_uid),
    'groups', jsonb_build_object(
      'major',  public.daily_groups(v_q.id, 'major'),
      'grade',  public.daily_groups(v_q.id, 'grade'),
      'gender', public.daily_groups(v_q.id, 'gender'),
      'age',    public.daily_groups(v_q.id, 'age'))
  );
end;
$$;

revoke execute on function public.get_past_dailies() from public, anon;
revoke execute on function public.get_past_daily(bigint) from public, anon;
grant execute on function public.get_past_dailies() to authenticated;
grant execute on function public.get_past_daily(bigint) to authenticated;
