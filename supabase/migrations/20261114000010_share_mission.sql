-- 2026-11-14 웰컴 미션 13일차 "오늘의 질문 3번 답하기" → "결과 카드 공유해 보기" (사용자 결정)
-- 1. share_logs: 결과 카드 공유 창을 연 기록 (앱은 실제로 보냈는지 알 수 없어서 "공유 창 열기"를 센다)
--    앱이 직접 쓰거나 읽지 못한다 (RLS 켜고 정책 없음). log_share() 서버 함수로만 쓴다
-- 2. 미션 조건 'share' 추가 · mission_count에서 센다
-- 3. 13일차 미션 내용 바꾸기 (보상은 그대로 mission_m). 13일차는 11/26에 열려서 아직 받은 사람이 없다

-- 1. 공유 기록
create table public.share_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 어떤 결과 카드를 공유했는지 (데이터 허브 · 밸런스 · 골라 줘 · 월드컵 · 오늘의 질문)
  kind text not null check (kind in ('hub', 'balance', 'pick', 'worldcup', 'daily')),
  created_at timestamptz not null default now()
);
create index share_logs_user_idx on public.share_logs (user_id);

alter table public.share_logs enable row level security;
revoke all on public.share_logs from anon, authenticated;

-- 공유 창을 열 때마다 앱이 부른다. 포인트를 주지 않는다 (미션 완료만 판단).
-- 연타로 기록이 쌓이지 않게 같은 사람은 1분에 한 번만 남긴다
create function public.log_share(p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_kind is null or p_kind not in ('hub', 'balance', 'pick', 'worldcup', 'daily') then
    raise exception 'invalid_share';
  end if;
  if exists (select 1 from public.share_logs where user_id = v_uid and created_at > now() - interval '1 minute') then
    return;
  end if;
  insert into public.share_logs (user_id, kind) values (v_uid, p_kind);
end;
$$;

revoke execute on function public.log_share(text) from public, anon;
grant execute on function public.log_share(text) to authenticated;

-- 2. 미션 조건 'share'
alter table public.missions drop constraint missions_condition_check;
alter table public.missions add constraint missions_condition_check check (condition in (
  'quiz', 'about_me', 'daily_answer', 'survey_response', 'post_vote', 'data_view',
  'bookmark', 'worldcup', 'post', 'comment', 'survey_create', 'feedback', 'share'));

create or replace function public.mission_count(p_uid uuid, p_condition text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case p_condition
    when 'quiz' then (select count(*) from public.mission_progress where user_id = p_uid and quiz_passed_at is not null)
    when 'about_me' then (select count(*) from public.profile_extras where user_id = p_uid and cardinality(interests) > 0)
    when 'daily_answer' then (select count(*) from public.daily_answers where user_id = p_uid)
    when 'survey_response' then (select count(*) from public.responses where user_id = p_uid and status = 'confirmed')
    when 'post_vote' then (select count(*) from public.post_votes where user_id = p_uid)
    when 'data_view' then (select count(*) from public.survey_views where user_id = p_uid)
    when 'bookmark' then (select count(*) from public.hub_bookmarks where user_id = p_uid)
    when 'worldcup' then (select count(*) from public.worldcup_plays where user_id = p_uid)
    when 'post' then (select count(*) from public.posts where author_id = p_uid and moderation <> 'removed')
    when 'comment' then (select count(*) from public.comments where author_id = p_uid and moderation not in ('removed', 'deleted'))
    when 'survey_create' then (select count(*) from public.surveys where owner_id = p_uid)
    when 'feedback' then (select count(*) from public.feedback where user_id = p_uid)
    when 'share' then (select count(*) from public.share_logs where user_id = p_uid)
    else 0
  end::integer;
$$;
revoke execute on function public.mission_count(uuid, text) from public, anon, authenticated;

-- 3. 13일차 바꾸기
update public.missions
   set code = 'share_1',
       title = '결과 카드 공유해 보기',
       description = '설문 결과나 커뮤니티 투표 결과를 카드 이미지로 친구에게 보내 봐요',
       condition = 'share',
       target = 1,
       href = '/community'
 where code = 'daily_3';

select day, code, title, condition, reward_key from public.missions where day = 13;
