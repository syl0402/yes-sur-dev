-- 오늘의 질문: 지난 질문 목록 대신 "오늘 질문 상세" (2026-10-30)
--
-- 사용자 결정: 커뮤니티의 "지난 질문"은 없애고, 홈의 오늘의 질문 카드를 누르면 오늘 질문의
-- 그룹별 결과 + 댓글 화면으로 간다. 지난 질문은 보여 주지 않는다.
-- get_today_daily에 groups(답한 뒤에만)·comment_count 추가, 지난 질문 함수는 지운다

drop function public.get_past_dailies();
drop function public.get_past_daily(bigint);

create or replace function public.get_today_daily()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_q public.daily_questions%rowtype;
  v_choice text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_q from public.daily_questions where day = v_today;
  if not found then
    return null;
  end if;
  select choice into v_choice from public.daily_answers where question_id = v_q.id and user_id = v_uid;

  return jsonb_build_object(
    'id', v_q.id,
    'question', v_q.question,
    'option_a', v_q.option_a,
    'option_b', v_q.option_b,
    'my_choice', v_choice,
    'a', case when v_choice is not null then
           (select count(*) from public.daily_answers where question_id = v_q.id and choice = 'a') end,
    'b', case when v_choice is not null then
           (select count(*) from public.daily_answers where question_id = v_q.id and choice = 'b') end,
    'streak', public.daily_streak(v_uid, case when v_choice is not null then v_today else v_today - 1 end),
    'reward', public.point_rule('daily_reward'),
    'streak_days', public.point_rule('streak_days'),
    'streak_bonus', public.point_rule('streak_bonus'),
    'rewarded', exists (select 1 from public.profiles where id = v_uid and account_type = 'student'),
    'comment_count', (select count(*) from public.comments
                       where target_type = 'daily' and target_id = v_q.id and moderation = 'visible'),
    -- 답한 뒤에만 그룹별 결과 (5명 미만 숨김)
    'groups', case when v_choice is not null then jsonb_build_object(
      'major',  public.daily_groups(v_q.id, 'major'),
      'grade',  public.daily_groups(v_q.id, 'grade'),
      'gender', public.daily_groups(v_q.id, 'gender'),
      'age',    public.daily_groups(v_q.id, 'age')) end
  );
end;
$$;

-- 댓글은 오늘 질문에만 (지난 질문은 보여 주지 않으니)
create or replace function public.comment_target_ok(p_type text, p_id bigint)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case p_type
           when 'post' then exists (select 1 from public.posts where id = p_id and moderation = 'visible')
           when 'daily' then exists (select 1 from public.daily_questions
                                      where id = p_id and day = (now() at time zone 'Asia/Seoul')::date)
           else false
         end;
$$;
