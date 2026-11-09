-- 설문 태그 2개 추가: #여가시간 #취미 (2026-11-10 사용자 요청)
-- '취미'는 20261108000003에서 숨긴(active=false) 태그라 다시 켠다. '여가시간'은 새로 추가
-- 순서: 비슷한 생활 태그인 '여행'(20) 바로 뒤 → 취미 21 · 여가시간 22, '트렌드·밈'은 맨 뒤 23

insert into public.tags (name, sort_order, active) values
  ('취미', 21, true),
  ('여가시간', 22, true)
on conflict (name) do update set sort_order = excluded.sort_order, active = true;

update public.tags set sort_order = 23 where name = '트렌드·밈';

-- 확인: 쓰는 태그 23개 (순서대로)
select sort_order, name from public.tags where active order by sort_order;
