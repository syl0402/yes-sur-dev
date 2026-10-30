-- 등록자 원본 CSV용 응답 목록 (2026-10-30)
--
-- 등록자 본인만. 응답 한 사람 = 한 줄: 계열·학년·성별·나이대 + 문항별 답(글자).
-- 개인정보:
--   - 이름·이메일·학교·출생연도·응답 시각·응답 시간·사용자 번호는 넣지 않는다
--   - 줄 순서는 제출 순서가 아니라 섞어서 (제출 시각으로 누구인지 맞히지 못하게)
--   - 인원이 result_min_count 미만인 그룹 이름은 '5명 미만'으로 (한 명뿐인 그룹으로 특정되지 않게)
--   - 확인 문항과 확인 문항을 틀린 응답은 뺀다 (결과 화면과 같은 유효 응답)
--
-- 돌려주는 모양:
-- { questions: [{ id, text, type }],
--   rows: [{ major, grade, gender, age, answers: ["가", "가 | 나", "4", "주관식 답", null…] }] }
-- answers는 questions 순서. 고르기 = 보기 이름(여럿이면 " | "로), 척도 = 1~5, 주관식 = 원문, 답 없음 = null

create function public.get_survey_raw(p_survey_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_ids bigint[];
  v_min numeric := public.point_rule('result_min_count');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select owner_id into v_owner from public.surveys where id = p_survey_id;
  if not found then
    raise exception 'survey_not_found';
  end if;
  if v_owner is distinct from v_uid then
    raise exception 'not_owner';
  end if;

  v_ids := public.survey_valid_ids(p_survey_id);

  return jsonb_build_object(
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'text', q.text, 'type', q.type) order by q.sort_order), '[]'::jsonb)
        from public.questions q
       where q.survey_id = p_survey_id and not q.is_attention_check),
    'rows', (
      with r as (
        select id,
               public.respondent_group('major', user_id) as major,
               public.respondent_group('grade', user_id) as grade,
               public.respondent_group('gender', user_id) as gender,
               public.respondent_group('age', user_id) as age
          from public.responses
         where id = any (v_ids)
      ),
      -- 인원이 적은 그룹은 이름을 가린다
      m as (
        select id,
               case when count(*) over (partition by major) < v_min then '5명 미만' else major end as major,
               case when count(*) over (partition by grade) < v_min then '5명 미만' else grade end as grade,
               case when count(*) over (partition by gender) < v_min then '5명 미만' else gender end as gender,
               case when count(*) over (partition by age) < v_min then '5명 미만' else age end as age
          from r
      )
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'major', m.major,
                 'grade', m.grade,
                 'gender', m.gender,
                 'age', m.age,
                 'answers', (
                   select coalesce(jsonb_agg(
                            case q.type
                              when 'scale' then a.scale_value::text
                              when 'text' then a.text_value
                              else (select string_agg(o.text, ' | ' order by o.sort_order)
                                      from public.question_options o
                                     where o.id = any (a.option_ids))
                            end order by q.sort_order), '[]'::jsonb)
                     from public.questions q
                     left join public.answers a on a.question_id = q.id and a.response_id = m.id
                    where q.survey_id = p_survey_id and not q.is_attention_check)
               ) order by md5(m.id::text)), '[]'::jsonb)
        from m)
  );
end;
$$;

revoke execute on function public.get_survey_raw(bigint) from public, anon;
grant execute on function public.get_survey_raw(bigint) to authenticated;
