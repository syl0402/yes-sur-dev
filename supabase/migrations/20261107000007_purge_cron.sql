-- 보관 기간이 지난 개인정보 매일 자동 삭제 (2026-11-07)
-- 제휴·광고 문의(1년) · 보상 연락처(30일). 지우는 내용은 public.purge_expired_personal_data()
-- pg_cron(정해진 시각에 SQL을 실행해 주는 Supabase 기능)을 켜고, 매일 새벽 4시(한국 시각)에 실행한다.
-- 이 파일이 실패해도(예: 권한) 앞 마이그레이션은 그대로. 대시보드 Database → Extensions에서 pg_cron을 켠 뒤 다시 실행

create extension if not exists pg_cron;

-- 같은 이름이면 바꿔 쓴다. cron은 UTC 기준: 19시 UTC = 한국 새벽 4시
select cron.schedule(
  'purge-expired-personal-data',
  '0 19 * * *',
  $$select public.purge_expired_personal_data()$$
);

-- 확인: 등록된 작업
select jobid, jobname, schedule, command from cron.job where jobname = 'purge-expired-personal-data';
