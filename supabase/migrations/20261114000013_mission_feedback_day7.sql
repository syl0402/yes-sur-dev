-- 2026-11-14 웰컴 미션 순서 바꾸기 (사용자 결정)
-- · 7일차: "설문 2개 응답하기" → "의견 보내기" (2주차 업데이트(11/21) 전에 의견을 받아 반영)
-- · 14일차: "의견 보내기" → "최종 피드백 설문 응답하기" (마지막 날 앱 안 공식 설문 "[최종 피드백] …"에 응답)
-- · "설문 2개 응답하기"는 12일차 "설문 3개 응답하기"와 겹쳐서 쉬게 둔다 (active = false, day 30으로 비켜 둠)
-- 7·14일차는 아직 아무도 도달하지 않았다 (시작일 11/14). 보상 금액은 그대로 point_rules
-- day는 고유 값이라 비켜 둔 뒤 바꾼다

-- 1. 미션 조건 'final_feedback': 제목이 "[최종 피드백]"으로 시작하는 설문에 낸 확정 응답 수
alter table public.missions drop constraint missions_condition_check;
alter table public.missions add constraint missions_condition_check check (condition in (
  'quiz', 'about_me', 'daily_answer', 'survey_response', 'post_vote', 'data_view',
  'bookmark', 'worldcup', 'post', 'comment', 'survey_create', 'feedback', 'share', 'final_feedback'));

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
    when 'final_feedback' then (
      select count(*) from public.responses r join public.surveys s on s.id = r.survey_id
       where r.user_id = p_uid and r.status = 'confirmed' and s.title like '[최종 피드백]%')
    else 0
  end::integer;
$$;
revoke execute on function public.mission_count(uuid, text) from public, anon, authenticated;

-- 2. 순서 바꾸기
update public.missions set day = 30, active = false where code = 'survey_2';
update public.missions set day = 7 where code = 'feedback_1';
insert into public.missions (code, day, title, description, condition, target, reward_key, href, meta)
values ('final_feedback', 14, '최종 피드백 설문 응답하기', '2주 동안 써 본 옛썰에 대해 솔직하게 알려 주세요', 'final_feedback', 1, 'mission_m', '/surveys', '{}')
on conflict (code) do nothing;

select day, code, title, active from public.missions order by day;
