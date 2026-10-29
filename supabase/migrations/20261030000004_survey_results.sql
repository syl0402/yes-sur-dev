-- 내 설문 결과 보기 + 응답 마감 (2026-10-30)
--
-- 등록자는 RLS 때문에 남의 응답(answers)을 직접 읽을 수 없다.
-- 그래서 서버 함수가 집계한 결과만 작성자 본인에게 돌려준다.
-- - 유효 응답: 확인 문항(is_attention_check)이 있으면 정답을 고른 응답만. 틀린 응답은 빼고 건수만 알려준다
-- - 응답자를 알 수 있는 정보(계정·시각)는 결과에 넣지 않는다
-- - 등록자는 응답 1개부터 볼 수 있다 (최소 응답 수 숨김은 데이터 허브 공개 결과에만)

-- =========================================================
-- 1. get_survey_results: 문항별 집계 (작성자 본인만)
-- 돌려주는 값:
--   { "total": 유효 응답 수, "excluded": 확인 문항을 틀려서 뺀 응답 수,
--     "questions": [{ "id", "type", "text", "answered",
--                     "options": [{ "id", "text", "count" }],      고르기 문항
--                     "scale": { "avg", "counts": [1점..5점] },     척도 문항
--                     "texts": [ "…" ] }] }                        주관식 (최근 순)
-- 확인 문항은 questions에서 뺀다
-- =========================================================
create function public.get_survey_results(p_survey_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_valid bigint[];
  v_all integer;
  v_questions jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select owner_id into v_owner from public.surveys where id = p_survey_id;
  if not found then
    raise exception 'survey_not_found';
  end if;
  if v_owner <> v_uid then
    raise exception 'not_owner';
  end if;

  select count(*) into v_all
    from public.responses
   where survey_id = p_survey_id and status = 'confirmed';

  -- 유효 응답: 확인 문항마다 정답을 고른 응답 (확인 문항이 없으면 전부)
  select coalesce(array_agg(r.id), '{}') into v_valid
    from public.responses r
   where r.survey_id = p_survey_id
     and r.status = 'confirmed'
     and not exists (
       select 1
         from public.questions q
        where q.survey_id = p_survey_id
          and q.is_attention_check
          and not exists (
            select 1
              from public.answers a
             where a.response_id = r.id
               and a.question_id = q.id
               and q.correct_option_id = any (a.option_ids)
          )
     );

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', q.id,
             'type', q.type,
             'text', q.text,
             'answered', (
               select count(*) from public.answers a
                where a.question_id = q.id and a.response_id = any (v_valid)
             ),
             'options', case when q.type in ('single', 'multi') then (
               select coalesce(jsonb_agg(
                        jsonb_build_object(
                          'id', o.id,
                          'text', o.text,
                          'count', (
                            select count(*) from public.answers a
                             where a.question_id = q.id
                               and a.response_id = any (v_valid)
                               and o.id = any (a.option_ids)
                          )
                        ) order by o.sort_order), '[]'::jsonb)
                 from public.question_options o
                where o.question_id = q.id
             ) else '[]'::jsonb end,
             'scale', case when q.type = 'scale' then (
               select jsonb_build_object(
                        'avg', round(avg(a.scale_value)::numeric, 1),
                        'counts', jsonb_build_array(
                          count(*) filter (where a.scale_value = 1),
                          count(*) filter (where a.scale_value = 2),
                          count(*) filter (where a.scale_value = 3),
                          count(*) filter (where a.scale_value = 4),
                          count(*) filter (where a.scale_value = 5)
                        )
                      )
                 from public.answers a
                where a.question_id = q.id and a.response_id = any (v_valid)
             ) end,
             'texts', case when q.type = 'text' then (
               select coalesce(jsonb_agg(a.text_value order by r.submitted_at desc), '[]'::jsonb)
                 from public.answers a
                 join public.responses r on r.id = a.response_id
                where a.question_id = q.id and a.response_id = any (v_valid)
             ) else '[]'::jsonb end
           ) order by q.sort_order), '[]'::jsonb)
    into v_questions
    from public.questions q
   where q.survey_id = p_survey_id
     and not q.is_attention_check;

  return jsonb_build_object(
    'total', cardinality(v_valid),
    'excluded', v_all - cardinality(v_valid),
    'questions', v_questions
  );
end;
$$;

revoke execute on function public.get_survey_results(bigint) from public, anon;
grant execute on function public.get_survey_results(bigint) to authenticated;

-- =========================================================
-- 2. close_survey: 응답 마감 (작성자 본인만). 이미 마감이면 아무것도 안 함
-- 등록비는 환불하지 않는다. 다시 여는 기능은 없다 (2026-10-30 결정)
-- =========================================================
create function public.close_survey(p_survey_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- 응답 제출과 동시에 와도 순서대로 처리되게 설문 행을 잠근다
  select owner_id into v_owner from public.surveys where id = p_survey_id for update;
  if not found then
    raise exception 'survey_not_found';
  end if;
  if v_owner <> v_uid then
    raise exception 'not_owner';
  end if;

  update public.surveys set status = 'closed' where id = p_survey_id and status = 'open';
end;
$$;

revoke execute on function public.close_survey(bigint) from public, anon;
grant execute on function public.close_survey(bigint) to authenticated;
