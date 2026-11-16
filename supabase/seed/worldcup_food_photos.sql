-- 음식 월드컵 3개 후보 사진 연결 (2026-11-16 · 사진 27장, 무료 라이선스 Unsplash·Pexels)
-- 준비: Supabase 대시보드 → Storage → content → worldcup 폴더(없으면 만들기)에 사진 파일을 그대로 올린다
--        (파일: C:\Users\abovq\Downloads\yessur-worldcup-photos\*.jpg · manifest.csv는 올리지 않음)
-- 그다음 이 파일을 실행. 이름이 같은 후보(라면·떡볶이·타코야키)는 같은 사진을 쓴다
-- 호떡·순대는 맞는 무료 사진이 없어 비워 둔다 (운영자 화면 [월드컵 사진]에서 나중에 올리면 됨)
-- 여러 번 실행해도 같은 결과

update public.worldcup_candidates c
   set image_path = 'worldcup/' || v.file || '.jpg'
  from public.worldcups w,
       (values ('돈가스', 'donkatsu'), ('제육덮밥', 'jeyuk'), ('라면', 'ramyeon'), ('김치찌개', 'kimchi-jjigae'),
               ('카레', 'curry'), ('비빔밥', 'bibimbap'), ('쌀국수', 'pho'), ('떡볶이', 'tteokbokki'),
               ('붕어빵', 'bungeoppang'), ('타코야키', 'takoyaki'), ('컵밥', 'cupbap'), ('와플', 'waffle'),
               ('츄러스', 'churros'), ('닭꼬치', 'dakkochi'), ('핫도그', 'hotdog'),
               ('치킨', 'chicken'), ('피자', 'pizza'), ('족발', 'jokbal'), ('보쌈', 'bossam'), ('햄버거', 'hamburger'),
               ('마라탕', 'malatang'), ('곱창', 'gopchang'), ('닭발', 'dakbal'), ('편의점 도시락', 'dosirak'),
               ('김밥', 'gimbap'), ('짜장면', 'jjajangmyeon'), ('회', 'hoe')) as v(name, file)
 where w.id = c.worldcup_id
   and w.title in ('최고의 학식 메뉴는?', '최고의 캠퍼스 간식은?', '과제 끝나고 시키는 최고의 야식')
   and c.name = v.name;

-- 확인: 월드컵마다 사진 수 (학식 8/8 · 간식 7/8 · 야식 15/16이면 정상)
select w.title, count(c.image_path) as 사진, count(*) as 후보
  from public.worldcups w join public.worldcup_candidates c on c.worldcup_id = w.id
 where w.title in ('최고의 학식 메뉴는?', '최고의 캠퍼스 간식은?', '과제 끝나고 시키는 최고의 야식')
 group by w.title;
