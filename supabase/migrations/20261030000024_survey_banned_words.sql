-- 설문에도 금칙어 검사 (2026-10-30)
--
-- 20261030000021의 금칙어 검사가 커뮤니티 글·댓글·닉네임에만 걸려 있어서
-- 설문 제목에 욕설이 그대로 올라간 것을 폰 확인 중에 발견. 설문 제목·설명·문항·보기에도 같은 검사를 붙인다.
-- create_survey 안에서 저장하는 순간 막혀서 앱에는 banned_word 오류로 보인다

create function public.check_survey_words()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.has_banned_word(new.title) or public.has_banned_word(new.description) then
    raise exception 'banned_word';
  end if;
  return new;
end;
$$;

create function public.check_text_words()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.has_banned_word(new.text) then
    raise exception 'banned_word';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_survey_words() from public, anon, authenticated;
revoke execute on function public.check_text_words() from public, anon, authenticated;

create trigger surveys_check_words
  before insert or update of title, description on public.surveys
  for each row execute function public.check_survey_words();

create trigger questions_check_words
  before insert or update of text on public.questions
  for each row execute function public.check_text_words();

create trigger question_options_check_words
  before insert or update of text on public.question_options
  for each row execute function public.check_text_words();
