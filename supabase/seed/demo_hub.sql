-- 데이터 탭 예시 데이터 (2026-10-31)
-- 마감된 공개 설문 5개 + 응답 23~120개씩을 만든다. 디자인·결과 화면 확인용
-- ⚠️ 개발 전용. 11/13 정리 때 맨 아래 "지우기"로 지운다 (PROGRESS 출시 전 할 일)
--
-- 만드는 법: 아래 do 블록 전체를 SQL Editor에 붙여 넣고 Run (여러 번 실행하면 그만큼 또 생긴다)
-- 작성자: 앞 2개 = 단체 테스터(✓ 인증 단체), 뒤 3개 = 작성자 없음("개인", 탈퇴한 사람 설문과 같은 모양)
-- 응답자: 실제 계정 없이 그룹(계열·학년·성별·나이)만 가진 익명 응답 (탈퇴한 사람의 응답과 같은 모양)
--   → 학생 테스터 본인도 목록에서 볼 수 있고, 나눠 보기 그래프가 여러 그룹으로 나뉜다

do $$
declare
  v_org uuid := (select id from public.profiles
                  where account_type = 'org' and approval_status = 'approved'
                  order by created_at limit 1);
  v_majors text[] := (select array_agg(distinct category_name) from public.major_fields);
  v_texts text[] := array[
    '생각보다 괜찮았어요', '가격이 조금 부담돼요', '친구 추천으로 알게 됐어요', '시간이 부족해서 아쉬워요',
    '학교 근처라 편해요', '조용한 곳이 좋아요', '잘 모르겠어요', '다음에도 참여하고 싶어요'];
  v_spec jsonb := $spec$[
    {"title": "[예시] 대학생 구독 서비스 이용 실태", "category": "consume", "n": 120, "days_ago": 2, "personal": false,
     "desc": "OTT·음악·쇼핑 멤버십 등 대학생의 구독 서비스 이용을 알아봐요.",
     "questions": [
       {"type": "single", "text": "지금 이용 중인 구독 서비스는 몇 개인가요?", "options": ["없음", "1개", "2~3개", "4개 이상"]},
       {"type": "multi",  "text": "이용 중인 구독 서비스를 모두 골라 주세요", "options": ["OTT(영상)", "음악", "쇼핑 멤버십", "클라우드·생산성", "배달"]},
       {"type": "single", "text": "한 달 구독료는 얼마쯤 쓰나요?", "options": ["1만 원 미만", "1~3만 원", "3~5만 원", "5만 원 이상"]},
       {"type": "scale",  "text": "구독료가 아깝다고 느끼나요?"},
       {"type": "single", "text": "계정을 친구·가족과 나눠 쓰나요?", "options": ["네", "아니요"]},
       {"type": "text",   "text": "구독을 끊었던 이유가 있다면 적어 주세요"}
     ]},
    {"title": "[예시] 시험 기간 공부 장소 조사", "category": "study", "n": 85, "days_ago": 5, "personal": false,
     "desc": "시험 기간에 어디서, 얼마나 공부하는지 알려 주세요.",
     "questions": [
       {"type": "single", "text": "시험 기간에 가장 많이 공부하는 곳은?", "options": ["학교 도서관", "카페", "집", "스터디카페", "빈 강의실"]},
       {"type": "single", "text": "하루 평균 공부 시간은?", "options": ["2시간 미만", "2~4시간", "4~6시간", "6시간 이상"]},
       {"type": "multi",  "text": "공부할 때 꼭 필요한 것은?", "options": ["콘센트", "조용함", "음료", "넓은 책상", "와이파이"]},
       {"type": "scale",  "text": "학교 도서관 자리 구하기는 얼마나 어렵나요?"},
       {"type": "text",   "text": "공부 장소에 바라는 점을 적어 주세요"}
     ]},
    {"title": "[예시] 대학생 아르바이트 경험", "category": "life", "n": 64, "days_ago": 8, "personal": true,
     "desc": "학기 중 아르바이트 경험을 묻는 개인 설문이에요.",
     "questions": [
       {"type": "single", "text": "학기 중에 아르바이트를 하나요?", "options": ["하고 있어요", "해 본 적 있어요", "안 해 봤어요"]},
       {"type": "single", "text": "일주일에 몇 시간 일하나요?", "options": ["10시간 미만", "10~20시간", "20시간 이상"]},
       {"type": "multi",  "text": "해 본 아르바이트를 모두 골라 주세요", "options": ["카페·음식점", "편의점", "과외·학원", "사무 보조", "배달·물류"]},
       {"type": "scale",  "text": "아르바이트가 학업에 방해된다고 느끼나요?"}
     ]},
    {"title": "[예시] 캠퍼스 카페 이용 만족도", "category": "consume", "n": 40, "days_ago": 11, "personal": true,
     "desc": "학교 안 카페를 얼마나, 왜 이용하는지 알아봐요.",
     "questions": [
       {"type": "single", "text": "학교 안 카페를 얼마나 자주 가나요?", "options": ["거의 매일", "주 2~3번", "가끔", "안 가요"]},
       {"type": "scale",  "text": "가격에 만족하나요?"},
       {"type": "scale",  "text": "맛에 만족하나요?"},
       {"type": "multi",  "text": "학교 카페를 가는 이유는?", "options": ["가까워서", "싸서", "공부하려고", "친구와 약속"]}
     ]},
    {"title": "[예시] 팀플 할 때 나는 어떤 사람?", "category": "taste", "n": 23, "days_ago": 13, "personal": true,
     "desc": "팀 프로젝트에서 내가 맡는 역할을 골라 주세요.",
     "questions": [
       {"type": "single", "text": "팀플에서 주로 맡는 역할은?", "options": ["조장", "자료 조사", "PPT 제작", "발표", "그때그때 달라요"]},
       {"type": "single", "text": "팀플 연락은 언제 답하나요?", "options": ["바로", "몇 시간 안에", "하루 안에"]},
       {"type": "scale",  "text": "팀플을 좋아하나요?"}
     ]}
  ]$spec$;
  v_s jsonb;
  v_id bigint;
  v_q record;
  v_resp bigint;
  v_i integer;
  v_gender text;
  v_n integer;
  v_pick integer;
  v_multi bigint[];
  v_days integer;
begin
  if v_org is null then
    raise exception '승인된 단체 테스터가 없어요 (dev_tools 6번으로 승인)';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);

  for v_s in select * from jsonb_array_elements(v_spec) loop
    v_days := (v_s->>'days_ago')::integer;

    -- 1. 설문 만들기 (단체라 등록비 0, 결과는 전체 공개)
    v_id := public.create_survey(gen_random_uuid(),
      (select id from public.survey_categories where key = v_s->>'category'),
      v_s->>'title', v_s->>'desc', 'all', 300, 7, v_s->'questions', 'public');

    -- 2. 익명 응답 n개 (5%는 확인 문항 오답으로 반려 → 신뢰도 계산에 쓰임)
    for v_i in 1 .. (v_s->>'n')::integer loop
      insert into public.responses (survey_id, user_id, submitted_at, status, duration_seconds)
      values (v_id, null,
              now() - make_interval(days => v_days) - random() * interval '6 days',
              case when random() < 0.05 then 'rejected' else 'confirmed' end,
              60 + floor(random() * 400)::integer)
      returning id into v_resp;

      -- 그룹은 응답이 들어온 뒤에 채운다 (넣는 순간에는 계정이 없어서 비어 있음)
      v_gender := (array['남성', '여성', '여성', '남성', '선택 안 함·미입력'])[1 + floor(random() * 5)::integer];
      update public.responses
         set grp_major  = v_majors[1 + floor(random() * array_length(v_majors, 1))::integer],
             grp_grade  = (array['1~2학년', '1~2학년', '3~4학년', '3~4학년', '5학년 이상', '대학원'])[1 + floor(random() * 6)::integer],
             grp_gender = v_gender,
             grp_age    = (array['20세 이하', '21~23세', '21~23세', '24~26세', '27세 이상'])[1 + floor(random() * 5)::integer]
       where id = v_resp;

      -- 3. 문항별 답 (앞 보기가 조금 더 많이 나오게, 성별에 따라 살짝 다르게 → 나눠 보기에서 차이가 보임)
      for v_q in
        select q.id, q.type,
               array(select o.id from public.question_options o where o.question_id = q.id order by o.sort_order) as opts
          from public.questions q
         where q.survey_id = v_id and not q.is_attention_check
         order by q.sort_order
      loop
        v_n := coalesce(array_length(v_q.opts, 1), 0);
        if v_q.type = 'single' then
          v_pick := least(v_n, 1 + floor(power(random(), case when v_gender = '여성' then 1.1 else 2.0 end) * v_n)::integer);
          insert into public.answers (response_id, question_id, option_ids) values (v_resp, v_q.id, array[v_q.opts[v_pick]]);
        elsif v_q.type = 'multi' then
          select array_agg(o) into v_multi
            from unnest(v_q.opts) with ordinality as t(o, k)
           where random() < 0.7 - k * 0.1;
          insert into public.answers (response_id, question_id, option_ids)
          values (v_resp, v_q.id, coalesce(v_multi, array[v_q.opts[1]]));
        elsif v_q.type = 'scale' then
          insert into public.answers (response_id, question_id, scale_value)
          values (v_resp, v_q.id, least(5, 1 + floor(power(random(), 0.7) * 5)::integer));
        else
          insert into public.answers (response_id, question_id, text_value)
          values (v_resp, v_q.id, v_texts[1 + floor(random() * array_length(v_texts, 1))::integer]);
        end if;
      end loop;
    end loop;

    -- 4. 응답 수 맞추고 마감 (마감 시각은 며칠 전으로)
    update public.surveys
       set response_count = (select count(*) from public.responses where survey_id = v_id and status = 'confirmed'),
           status = 'closed'
     where id = v_id;
    update public.surveys
       set closes_at = now() - make_interval(days => v_days),
           created_at = now() - make_interval(days => v_days + 7)
     where id = v_id;

    -- 뒤 3개는 개인 설문처럼 (작성자 없음 → "개인")
    if (v_s->>'personal')::boolean then
      update public.surveys set owner_id = null, host_name = null, host_verified = false where id = v_id;
    end if;
  end loop;
end;
$$;

-- 확인: 만든 예시 설문
select id, title, coalesce(host_name, '개인') as 작성, response_count as 응답, status
  from public.surveys where title like '[예시]%' order by id;


-- ── 지우기 (11/13 정리 때) ─────────────────────────────────
-- 설문을 지우면 문항·응답·답이 같이 지워진다
-- delete from public.surveys where title like '[예시]%';
