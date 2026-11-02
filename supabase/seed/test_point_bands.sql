-- 포인트 구간(20261103000003) 확인용 테스트 (2026-11-03)
-- 마이그레이션 적용 후 SQL Editor에서 Run. 바꾸는 내용 없음 (결과만 보여 주려고 오류를 낸다). 괄호 안이 기대값

do $$
declare
  v_log text := E'\n';
  m integer;
begin
  v_log := v_log || format('1문항: 보상 %s(10) · 등록비 %s(5)',
    public.calc_survey_reward(1, 1), public.calc_survey_price(1, 1)) || E'\n';
  -- 경계: 3 | 4 · 7 | 8 · 14 | 15 · 20분 (2문항 이상)
  foreach m in array array[1, 3, 4, 7, 8, 14, 15, 20] loop
    v_log := v_log || format('%s분: 보상 %s · 등록비 %s', m,
      public.calc_survey_reward(5, m), public.calc_survey_price(5, m)) || E'\n';
  end loop;
  v_log := v_log || '(기대: 1·3분 30/15 · 4·7분 60/30 · 8·14분 100/50 · 15·20분 200/100)' || E'\n';
  v_log := v_log || format('오늘의 질문 7일 보너스 %s(20) · 커뮤니티 하루 최대 %s(10) · 너무 빠름 비율 %s(0.25)',
    public.point_rule('streak_bonus'), public.point_rule('community_daily_cap'), public.point_rule('min_time_ratio')) || E'\n';
  v_log := v_log || format('너무 빠름 기준: 고르는 문항 10개 %s초(25) · 주관식 30개 %s초(300)',
    10 * public.point_rule('sec_per_choice') * public.point_rule('min_time_ratio'),
    30 * public.point_rule('sec_per_text') * public.point_rule('min_time_ratio')) || E'\n';

  raise exception '테스트 결과:%', v_log;
end;
$$;
