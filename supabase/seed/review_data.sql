-- 테스트 전 데이터 훑어보기 (2026-11-13) — 읽기만 한다. 아무것도 지우지 않는다
-- 쓰는 법: 블록 하나씩 SQL Editor에 붙여 Run → 결과 표 오른쪽 위 "Copy" (또는 Export CSV) → 채팅에 붙이기
-- "의심" 칸에 이유가 붙은 줄이 지울 후보

-- ── 1. 설문 ─────────────────────────────────────────────────────────
select s.id,
       left(s.title, 40) as title,
       case when p.role = 'admin' then '옛썰 공식'
            when p.account_type = 'org' then '단체'
            else '학생' end as who,
       to_char(s.created_at at time zone 'Asia/Seoul', 'MM-DD') as made,
       s.status,
       s.response_count || '/' || s.target_responses as resp,
       (select count(*) from public.questions q where q.survey_id = s.id) as q_count,
       concat_ws(', ',
         case when s.title like '[테스트]%' then '테스트 제목' end,
         case when s.title like '[예시]%' then '예시' end,
         case when char_length(trim(s.title)) < 6 then '제목 짧음' end,
         case when not exists (select 1 from public.questions q where q.survey_id = s.id) then '문항 없음' end,
         case when exists (
           select 1 from public.questions q
            where q.survey_id = s.id and q.type in ('single', 'multi')
              and (select count(*) from public.question_options o where o.question_id = q.id) < 2) then '보기 2개 미만' end,
         case when s.price_per_response = 0 and p.account_type <> 'org' and p.role is distinct from 'admin' then '옛 규칙(등록비 0)' end,
         case when s.created_at < timestamptz '2026-11-01' then '11/1 이전' end
       ) as suspicious
  from public.surveys s
  left join public.profiles p on p.id = s.owner_id
 order by s.created_at;


-- ── 2. 커뮤니티 글 (밸런스·공감·골라줘) ───────────────────────────────
select x.id,
       x.kind,
       left(x.question, 40) as question,
       array_to_string(x.options, ' / ') as options,
       x.moderation,
       to_char(x.created_at at time zone 'Asia/Seoul', 'MM-DD') as made,
       (select count(*) from public.post_votes v where v.post_id = x.id) as votes,
       (select count(*) from public.comments c where c.target_type = 'post' and c.target_id = x.id) as comments,
       concat_ws(', ',
         case when char_length(trim(x.question)) < 6 then '질문 짧음' end,
         case when exists (select 1 from unnest(x.options) o where char_length(trim(o)) < 2) then '보기 짧음' end,
         case when x.question ~* '(테스트|test|ㅁㄴㅇ|ㅇㅇ|asdf)' then '테스트 같음' end,
         case when x.moderation <> 'visible' then '숨김·삭제됨' end
       ) as suspicious
  from public.posts x
 order by x.created_at;


-- ── 3. 댓글 (짧거나 테스트 같은 것만) ─────────────────────────────────
select c.id, c.target_type, c.target_id, left(c.body, 40) as body, c.moderation,
       to_char(c.created_at at time zone 'Asia/Seoul', 'MM-DD') as made
  from public.comments c
 where char_length(trim(c.body)) < 4
    or c.body ~* '(테스트|test|ㅁㄴㅇ|asdf)'
 order by c.created_at;


-- ── 4. 월드컵 (후보 수가 크기와 안 맞으면 고장) ───────────────────────
select w.id, left(w.title, 40) as title, w.size,
       (select count(*) from public.worldcup_candidates k where k.worldcup_id = w.id) as candidates,
       (select count(*) from public.worldcup_plays pl where pl.worldcup_id = w.id) as plays,
       to_char(w.created_at at time zone 'Asia/Seoul', 'MM-DD') as made,
       case when (select count(*) from public.worldcup_candidates k where k.worldcup_id = w.id) < w.size
            then '후보 부족(고장)' end as suspicious
  from public.worldcups w
 order by w.created_at;
