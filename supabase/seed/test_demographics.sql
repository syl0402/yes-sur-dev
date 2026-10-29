-- 성별·출생연도 확인용 테스트 (2026-10-30)
-- 20261030000007_demographics.sql, 20261030000008_demographics_lock.sql 적용 후 SQL Editor에서 Run.
-- 마지막에 일부러 오류를 내서 바꾼 내용은 전부 취소된다 (DB에 남지 않음).

do $$
declare
  v_student uuid := (select id from public.profiles where account_type = 'student' order by created_at limit 1);
  v_org uuid := (select id from public.profiles where account_type = 'org' order by created_at limit 1);
  v_year integer := extract(year from now())::integer;
  v_log text := E'\n';
begin
  -- 기존 회원처럼 비워 두고 시작 (블록 끝에서 취소됨)
  update public.profiles set gender = null, birth_year = null where id = v_student;
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);

  -- 1. 정상 입력
  perform public.update_my_demographics('female', v_year - 22);
  v_log := v_log || format('1. 저장: 성별 %s(female) · 출생연도 %s(%s)',
    (select gender from public.profiles where id = v_student),
    (select birth_year from public.profiles where id = v_student), v_year - 22) || E'\n';

  -- 2. 한 번 저장하면 다시 못 바꿈
  begin
    perform public.update_my_demographics('undisclosed', v_year - 25);
    v_log := v_log || E'2. 다시 바꾸기: ❌ 통과됨\n';
  exception when others then
    v_log := v_log || '2. 다시 바꾸기: ' || sqlerrm || E'(demographics_locked)\n';
  end;
  -- 3~5는 검사 순서를 보려고 다시 비워 둔다
  update public.profiles set gender = null, birth_year = null where id = v_student;

  -- 3~5. 잘못된 값은 거절
  begin
    perform public.update_my_demographics('other', v_year - 22);
    v_log := v_log || E'3. 잘못된 성별: ❌ 통과됨\n';
  exception when others then
    v_log := v_log || '3. 잘못된 성별: ' || sqlerrm || E'(invalid_gender)\n';
  end;
  begin
    perform public.update_my_demographics('male', v_year - 5);
    v_log := v_log || E'4. 5살: ❌ 통과됨\n';
  exception when others then
    v_log := v_log || '4. 5살: ' || sqlerrm || E'(invalid_birth_year)\n';
  end;
  begin
    perform public.update_my_demographics('male', null);
    v_log := v_log || E'5. 출생연도 빈칸: ❌ 통과됨\n';
  exception when others then
    v_log := v_log || '5. 출생연도 빈칸: ' || sqlerrm || E'(invalid_birth_year)\n';
  end;

  -- 6. 단체 계정은 입력 대상이 아님
  if v_org is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
    begin
      perform public.update_my_demographics('male', v_year - 30);
      v_log := v_log || E'6. 단체: ❌ 통과됨\n';
    exception when others then
      v_log := v_log || '6. 단체: ' || sqlerrm || E'(not_student)\n';
    end;
  end if;

  raise exception '테스트 결과 (바꾼 내용은 모두 취소됨):%', v_log;
end;
$$;
