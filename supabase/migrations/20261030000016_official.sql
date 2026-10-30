-- 옛썰 공식 설문 (2026-10-30)
--
-- 운영자 계정(profiles.role = 'admin')이 올린 설문은 주최를 "옛썰 공식"으로 표시한다 (앱에서 "옛썰 공식 ✓").
-- 공식 설문의 결과는 이미 무료 열람 (survey_free_reason = 'official', 20261030000009).
-- 운영자 지정은 dev_tools.sql 11번 (팀 메일로 단체 가입한 계정을 승인 + admin).

-- 주최 이름: 운영자면 "옛썰 공식", 승인된 단체면 (학교 +) 단체 이름, 학생이면 null ("개인")
create or replace function public.survey_host_name(p_owner uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when p.role = 'admin' then '옛썰 공식'
           when p.account_type = 'org' and p.approval_status = 'approved' then (
             select case
                      when o.kind = 'campus' and u.name is not null and position(u.name in o.name) = 0
                        then u.name || ' ' || o.name
                      else o.name
                    end
               from public.organizations o
               left join public.universities u on u.id = o.university_id
              where o.id = p.id)
         end
    from public.profiles p
   where p.id = p_owner;
$$;
