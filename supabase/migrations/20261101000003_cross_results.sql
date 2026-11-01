-- 교차 분석 (2026-11-01)
--
-- "○○라고 답한 사람들끼리" 다른 문항 결과를 본다. 예: 공부 장소 '도서관'이라고 답한 사람의 공부 시간 분포.
-- 기존 나눠 보기(계열·학년·성별·나이대)와 같은 모양으로 돌려줘서 앱의 그룹 표시를 그대로 쓴다.
-- 기준 문항은 하나 고르기·척도만 (여러 개 고르기는 한 사람이 여러 묶음에 들어가고, 주관식은 묶을 수 없음).
-- 권한·숨김은 get_full_results와 같다: 등록자 또는 열람한 사람만, 확인 문항 통과 응답만,
-- result_min_count 미만 묶음은 인원·결과 없이 숨김.

create function public.get_cross_results(p_survey_id bigint, p_question_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_survey public.surveys%rowtype;
  v_type text;
  v_ids bigint[];
  v_min numeric := public.point_rule('result_min_count');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_survey from public.surveys where id = p_survey_id;
  if not found then
    raise exception 'survey_not_found';
  end if;
  if not coalesce(v_survey.owner_id = v_uid, false)
     and not exists (select 1 from public.survey_views where survey_id = p_survey_id and user_id = v_uid) then
    raise exception 'not_viewed';
  end if;

  select type into v_type from public.questions
   where id = p_question_id and survey_id = p_survey_id and not is_attention_check;
  if v_type is null or v_type not in ('single', 'scale') then
    raise exception 'invalid_cross';
  end if;

  v_ids := public.survey_valid_ids(p_survey_id);

  return jsonb_build_object(
    'question_id', p_question_id,
    'groups', (
      with picks as (
        -- 응답마다 기준 문항의 답 (하나 고르기 = 고른 보기, 척도 = 점수)
        select a.response_id,
               case when v_type = 'single' then a.option_ids[1] else a.scale_value end as pick
          from public.answers a
         where a.question_id = p_question_id and a.response_id = any (v_ids)
      ),
      keys as (
        -- 묶음 순서·이름: 보기 순서대로 / 1~5점
        select o.id as pick, o.text as label, o.sort_order as ord
          from public.question_options o
         where v_type = 'single' and o.question_id = p_question_id
        union all
        select g, g || '점', g
          from generate_series(1, 5) g
         where v_type = 'scale'
      ),
      g as (
        select k.label, k.ord, array_agg(p.response_id) as ids, count(*)::integer as n
          from keys k join picks p on p.pick = k.pick
         group by k.label, k.ord
      )
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'label', label,
                 'hidden', n < v_min,
                 'n', case when n < v_min then null else n end,
                 'questions', case when n >= v_min then public.question_stats(p_survey_id, ids) else '[]'::jsonb end
               ) order by ord), '[]'::jsonb)
        from g
    )
  );
end;
$$;

revoke execute on function public.get_cross_results(bigint, bigint) from public, anon;
grant execute on function public.get_cross_results(bigint, bigint) to authenticated;
