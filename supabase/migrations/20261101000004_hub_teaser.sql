-- 열람 전 인사이트 1개 미리보기 (2026-11-01)
--
-- 데이터 허브 결과 상세에서 열람(포인트) 전에 "응답자 72%가 ‘○○’를 골랐어요" 한 줄을 먼저 보여 줘서 열람을 유도한다.
-- 하나 고르기 문항 중 1위 비율이 가장 높은 것 하나만 (그룹·개인 정보 없음).
-- 목록에 보이는 설문(survey_listed: 공개 범위·마감·최소 응답 수)만. 조건이 안 맞거나 고르기 문항이 없으면 null.

create function public.get_hub_teaser(p_survey_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_q jsonb;
  v_o jsonb;
  v_best jsonb;
  v_best_pct numeric := -1;
  v_index integer := 0;
  v_pct numeric;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not coalesce(public.survey_listed(p_survey_id, v_uid), false) then
    return null;
  end if;

  for v_q in select * from jsonb_array_elements(public.question_stats(p_survey_id, public.survey_valid_ids(p_survey_id))) loop
    v_index := v_index + 1;
    continue when v_q->>'type' <> 'single' or (v_q->>'answered')::integer = 0;
    for v_o in select * from jsonb_array_elements(v_q->'options') loop
      v_pct := round((v_o->>'count')::numeric * 100 / (v_q->>'answered')::numeric);
      if v_pct > v_best_pct then
        v_best_pct := v_pct;
        v_best := jsonb_build_object('index', v_index, 'question', v_q->>'text', 'option', v_o->>'text', 'pct', v_pct);
      end if;
    end loop;
  end loop;

  return v_best;
end;
$$;

revoke execute on function public.get_hub_teaser(bigint) from public, anon;
grant execute on function public.get_hub_teaser(bigint) to authenticated;
