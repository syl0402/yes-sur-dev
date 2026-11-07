-- 설문 태그 표 읽기 허가 (2026-11-07)
-- 20261107000001에서 빠짐: 이 프로젝트는 새 표를 앱(authenticated)이 읽으려면 grant가 따로 필요하다.
-- 어떤 줄을 읽을 수 있는지는 그대로 RLS 정책이 정한다 (tags: 쓰는 태그만 · survey_tags: 볼 수 있는 설문 것만). 쓰기는 주지 않는다

grant select on public.tags, public.survey_tags to authenticated;
