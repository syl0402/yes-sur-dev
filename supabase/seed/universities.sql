-- 가입할 수 있는 학교 · 학생 메일 주소 (2026-10-31 조사)
-- 20261031000002_university_domains.sql 적용 후 SQL Editor에서 Run. 여러 번 실행해도 안전 (이미 있으면 건너뜀)
--
-- 주소 근거: 학교 정보통신처·메일 안내 공식 페이지 (확신도 낮은 곳은 ⚠️, 그 학교 학생에게 확인 필요)
-- 맨 앞 주소가 대표(가입 화면 기본값). 분교·국제캠퍼스는 본교와 같은 주소라 같은 학교로 들어간다
-- 건국대 글로컬(충주) kku.ac.kr은 서울이 아니라 뺐다
-- 학교·주소를 바꾸려면 이 파일을 고치고 다시 Run (지우기는 Table Editor → university_domains)

with schools(name, domains) as (
  values
    ('서울대학교',         array['snu.ac.kr']),
    ('연세대학교',         array['yonsei.ac.kr']),
    ('고려대학교',         array['korea.ac.kr']),
    ('성균관대학교',       array['g.skku.edu', 'skku.edu']),
    ('한양대학교',         array['hanyang.ac.kr']),
    ('중앙대학교',         array['cau.ac.kr']),
    ('경희대학교',         array['khu.ac.kr']),
    ('한국외국어대학교',   array['hufs.ac.kr']),
    ('서울시립대학교',     array['uos.ac.kr']),
    ('이화여자대학교',     array['ewha.ac.kr', 'ewhain.net']),
    ('서강대학교',         array['u.sogang.ac.kr', 'sogang.ac.kr', 'o365.sogang.ac.kr']),
    ('건국대학교',         array['konkuk.ac.kr']),
    ('동국대학교',         array['dgu.ac.kr', 'dongguk.edu', 'dgu.edu']),
    ('홍익대학교',         array['g.hongik.ac.kr', 'mail.hongik.ac.kr']),
    ('숙명여자대학교',     array['sookmyung.ac.kr']),
    ('국민대학교',         array['kookmin.ac.kr']),
    ('숭실대학교',         array['soongsil.ac.kr']),
    ('세종대학교',         array['sju.ac.kr']),
    ('광운대학교',         array['kw.ac.kr']),
    ('상명대학교',         array['sangmyung.kr', 'sangmyung.ac.kr']),
    ('서울과학기술대학교', array['seoultech.ac.kr']),
    ('성신여자대학교',     array['sungshin.ac.kr']),
    ('덕성여자대학교',     array['duksung.ac.kr']),
    ('명지대학교',         array['mju.ac.kr']),          -- ⚠️ 추정
    ('가톨릭대학교',       array['catholic.ac.kr']),     -- ⚠️ 추정
    ('동덕여자대학교',     array['dongduk.ac.kr']),      -- ⚠️ 추정
    ('서울여자대학교',     array['swu.ac.kr'])           -- ⚠️ 추정
),
-- 1. 학교 (대표 주소 = 첫 번째)
new_schools as (
  insert into public.universities (name, email_domain)
  select s.name, s.domains[1] from schools s
   where not exists (select 1 from public.universities u where u.name = s.name)
  on conflict (email_domain) do nothing
  returning id, name
),
all_schools as (
  select id, name from new_schools
  union
  select id, name from public.universities
)
-- 2. 메일 주소 (첫 번째가 대표)
insert into public.university_domains (domain, university_id, is_primary)
select d.domain, a.id, d.ord = 1
  from schools s
  join all_schools a on a.name = s.name
  cross join lateral unnest(s.domains) with ordinality as d(domain, ord)
on conflict (domain) do nothing;

-- 확인: 학교별 주소
select u.name as 학교, string_agg(d.domain, ', ' order by d.is_primary desc, d.domain) as 메일_주소
  from public.universities u
  left join public.university_domains d on d.university_id = u.id
 group by u.name
 order by u.name;
