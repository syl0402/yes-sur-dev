# DB

> 표를 바꾸면 이 문서도 같이 고친다. SQL 원본은 `supabase/migrations/`.

## 적용 방법

1. `supabase/migrations/`의 새 SQL 파일 내용을 복사
2. Supabase 대시보드 → SQL Editor에 붙여넣고 Run
3. 이미 적용한 파일은 다시 실행하지 않는다. 바꿀 게 있으면 **새 파일**을 만든다

| 파일 | 내용 | 적용일 |
| --- | --- | --- |
| `20261026000001_base_tables.sql` | 학교·회원정보·포인트 규칙·포인트 기록, 잔액 함수 | 2026-10-26 |
| `20261026000002_complete_signup.sql` | 가입 완료 함수 (도메인 검사·회원정보·웰컴 지급) | 2026-10-26 |
| `20261026000003_signup_terms.sql` | 약관 동의 시각, 학년 → 입학년도, 로그인 전 학교 목록 읽기, 가입 함수 매개변수 변경 | 2026-10-26 |
| `20261027000001_major_fields.sql` | 표준 전공 계열 표, 학과 → 전공 계열, 가입 함수 매개변수 변경 | 2026-10-27 |
| `20261027000002_org_signup.sql` | 회원 종류 student/org 정리, 단체 정보 표, 단체 신청 함수 | 2026-10-27 |
| `20261027000003_email_check.sql` | 가입 여부 확인 함수 (로그인 전에도 사용) | 2026-10-27 |
| `20261029000001_surveys.sql` | 설문·문항·선택지·응답·답변 표, 카테고리, 보상 계산, 응답 제출 함수 | 2026-10-29 |
| `20261030000001_survey_create.sql` | 설문 등록 함수, 등록 설정값, 4종 문항 응답, 주의 문항 정답 숨기기 | 2026-10-30 |
| `20261030000002_survey_host.sql` | 설문 작성자 표시 칸(단체 이름·인증), 등록 함수가 함께 저장 | 2026-10-30 |
| `20261030000003_survey_host_school.sql` | 교내 단체는 학교 이름을 붙여 표시. 설문 저장 때 트리거가 작성자 이름을 채움 | 2026-10-30 |
| `20261030000004_survey_results.sql` | 내 설문 결과 집계 함수, 응답 마감 함수 | 2026-10-30 |
| `20261030000005_point_economy.sql` | 포인트 구조 변경(보상 낮춤, 등록비 = 1명당 값 × 인원, 조기 마감 환불), 확인 문항 오답 = 미지급·다시 응답, 응답 시간 저장 | 2026-10-30 |
| `20261030000006_result_visibility.sql` | 결과 공개 범위(전체·우리 학교만·비공개), 등록 때 함께 저장, 작성자가 바꾸는 함수 | 2026-10-30 |
| `20261030000007_demographics.sql` | 회원정보에 성별·출생연도, 가입 함수 매개변수 추가, 본인 수정 함수 | 2026-10-30 |
| `20261030000008_demographics_lock.sql` | 성별·출생연도는 한 번 정하면 고정 (비어 있는 칸만 채움) | 2026-10-30 |
| `20261030000009_data_hub.sql` | 데이터 허브: 열람 기록 표, 목록·미리보기·내 답 비교·열람(차감·분배)·전체 결과(나눠 보기) 함수 | 2026-10-30 |
| `20261030000010_closed_at.sql` | 일찍 마감하면 마감일(`closes_at`)을 그 순간으로 (트리거 `surveys_set_closed_at`) | 2026-10-30 |
| `20261030000011_survey_raw.sql` | 등록자 원본 CSV용 `get_survey_raw` (응답 한 명 = 한 줄, 순서 섞음, 5명 미만 그룹 이름 가림) | 2026-10-30 |
| `20261030000012_my_views.sql` | 마이 탭 "열람한 결과"용 `get_my_views` (내 열람 기록 + 제목·주최) | 2026-10-30 |
| `20261030000013_org_public.sql` | 단체 설문은 결과 "나만 보기" 불가 (트리거 `surveys_org_visibility`, 테스트 기간 결과 공개 조건으로 무료) | 2026-10-30 |
| `20261030000014_reports.sql` | 신고: `reports` 표, 설문 `moderation`(보임·숨김·삭제), `report_survey`, n명 신고 시 자동 숨김, 숨긴 설문은 목록·허브·응답에서 막음 | 2026-10-30 |
| `20261030000015_delete_account.sql` | 회원 탈퇴: 응답에 그룹 저장(응답 시점), 회원 삭제 시 응답·설문·열람 기록은 익명으로 남김, 등록자 빈 설문 대비(허브 목록·전체 결과·열람), 웰컴 한 번만(`welcomed_emails`), `delete_my_account` | 2026-10-30 |
| `20261030000016_official.sql` | 운영자(`role = admin`) 설문의 주최를 "옛썰 공식"으로 (`survey_host_name`) | 2026-10-30 |
| `20261030000017_feedback.sql` | 의견 보내기: `feedback` 표(본인만 읽기), `send_feedback`(하루 `feedback_daily_max`건) | 2026-10-30 |
| `20261030000018_daily.sql` | 오늘의 질문 + 출석: `daily_questions`(오늘까지만 읽기), `daily_answers`(본인만), `get_today_daily`, `answer_daily`(출석 `daily_reward`, `streak_days`일마다 `streak_bonus`), 포인트 이유 `daily_question`·`streak_bonus` | 2026-10-30 |
| `20261030000019_community.sql` | 커뮤니티 1단계: `posts`(종류 balance·relate·pick), `post_votes`(투표 시점 그룹 저장), `create_post`·`vote_post`·`get_feed`·`get_post`, 포인트 이유 `community`·`creator_bonus`. 앱은 표를 직접 읽지 않음 | 2026-10-30 |
| `20261030000020_community_comments.sql` | 커뮤니티 2-1: 글 본문(`body`)·작성자 삭제(`deleted`), `comments`·`comment_likes`, `update_post_body`·`delete_post`·`create_comment`·`delete_comment`·`like_comment`·`get_comments`, 글·댓글 신고 `report_content` | 2026-10-30 |
| `20261030000021_community_safety.sql` | 커뮤니티 2-2: 금칙어 `banned_words`(글·댓글·닉네임 트리거), `change_nickname`(학생, `nickname_change_days`일에 한 번), 오늘의 질문 답에 그룹 저장, (지난 질문 함수는 000022에서 지움) | 2026-10-30 |
| `20261030000022_daily_today_detail.sql` | 지난 질문 대신 오늘 질문 상세: `get_today_daily`에 `groups`(답한 뒤)·`comment_count`, 지난 질문 함수 삭제, 오늘의 질문 댓글은 오늘 것만 | 2026-10-30 |
| `20261030000023_community_promo.sql` | 커뮤니티 3단계: 설문 홍보(`posts.kind = promo` + `survey_id`, 설문 하나에 하나, 마감되면 피드에서 빠짐) `create_promo`·`get_promotable_surveys`, 계열 대항전 `get_major_ranking`, 인기순 = 투표 + 댓글 | 2026-10-30 |
| `20261030000024_survey_banned_words.sql` | 설문 제목·설명·문항·보기에도 금칙어 검사 (트리거, 2026-10-30 폰 확인 중 발견) | 2026-10-30 |
| `20261030000025_invite.sql` | 친구 초대: `profiles.invite_code`, `invites`(한 사람 한 번), `get_my_invite`·`redeem_invite`, 포인트 이유 `invite` | 2026-10-30 |
| `20261031000001_too_fast.sql` | 너무 빠른 응답(문항 수 × `min_seconds_per_question`초 미만)은 확인 문항 오답과 같게 반려, `submit_response`에 `reason`(attention·too_fast) | 2026-10-31 |
| `20261110000008_weekly_best_created_at.sql` | `get_weekly_best` 결과에 `created_at` 추가 (홈 인기 투표 NEW 표시용, 고르는 기준 그대로) | 2026-11-10 |
| `20261110000006_question_options.sql` | 문항 옵션: `questions.is_required`(주관식만 false)·`shuffle_options`, `question_options.kind`(normal·none·other, 문항마다 특별 보기 1개씩). `create_survey` 문항에 required·shuffle·none·other, `submit_response` 선택 주관식 건너뛰기·기타 글(`other_text` 1~100자 → `text_value`)·해당 없음 단독, `get_survey_results` `other_texts`·보기 `kind`, `get_survey_raw` "기타 (직접 입력): 글", `get_survey_for_copy` 옵션 포함 | 2026-11-10 |
| `20261110000005_tags_hobby.sql` | 태그 2개 추가: 취미(숨김 → 다시 켬)·여가시간(새로). '여행' 뒤, 트렌드·밈은 맨 뒤 → 23개 | 2026-11-10 |
| `20261110000004_my_posts.sql` | `get_my_posts`·`get_my_comments`: 마이 "내가 쓴 글" (본인 것만, 내가 지운 것 제외) | 2026-11-10 |
| `20261110000003_survey_delete_confirmed.sql` | `delete_survey`: 정상 응답 0명이면 삭제 (확인 문항 오답 응답은 함께 지움) | 2026-11-10 |
| `20261110000002_survey_delete.sql` | `delete_survey`(등록비 − 받은 환불만큼 `survey_delete`로 환불)·`get_survey_for_copy`(다시 고치기용, 확인 문항 제외) | 2026-11-10 |
| `20261110000001_hub_show_mine.sql` | `get_hub_list`: 남에게 보이는 조건을 갖춘 내 설문도 목록에 + `mine` | 2026-11-10 |
| `20261108000003_tags_final.sql` | 태그 확정 21개 (기획팀): 같은 뜻은 이름만 변경(연결 유지) · 빠진 6개 숨김·연결 삭제 · 새 7개 추가 · 순서 | 2026-11-08 |
| `20261108000002_survey_host_school.sql` | `surveys.host_university_id` = 작성자 학교 (트리거로 채움) → 설문 탭 "우리 학교" 칩·추천순 | 2026-11-08 |
| `20261108000001_survey_edit.sql` | `update_survey_texts`: 작성자·마감 전 설명·보상 안내 수정, `set_survey_reward` 금칙어 검사 | 2026-11-08 |
| `20261107000007_purge_cron.sql` | `pg_cron` 켜고 매일 한국 새벽 4시 `purge_expired_personal_data()` (작업 이름 `purge-expired-personal-data`) | 2026-11-07 |
| `20261107000006_reward_contacts.sql` | 설문 보상 연락처: `survey_rewards`(작성자 보상 안내 2~300자 + 동의 시각) · `reward_contacts`(휴대폰, (설문, 회원) 기본 키, **앱 직접 접근 불가**) · `set_survey_reward`·`submit_reward_contact`(confirmed 응답자만, 동의 필수)·`has_my_reward_contact`·`get_reward_contacts`(작성자만, 번호만 무작위 순서)·`clear_reward_contacts`, `reward_contact_keep_days` 30 | 2026-11-07 |
| `20261107000003~05_partnership*.sql` | 제휴·광고 문의: `partnership_inquiries`(담당자 정보, 본인만 읽기) · `send_partnership_inquiry` · 알게 된 경로 필수(store·friend·sns·community·search·school·other, 기타는 직접 입력) · `partnership_keep_days` 365 · `purge_expired_personal_data()` | 2026-11-07 |
| `20261107000002_survey_tags_grant.sql` | 태그 표 읽기 허가 (`grant select … to authenticated`). **새 표는 grant가 따로 필요** — 빠지면 앱에서 빈 목록 | 2026-11-07 |
| `20261107000001_survey_tags.sql` | 설문 태그: `tags`(운영자 목록) · `survey_tags`(설문↔태그, 기본 키로 중복 방지), `set_survey_tags()`, `survey_tag_max` 3, `get_hub_list`에 `tags`, 첫 태그 20개(임시) | 2026-11-07 |
| `20261103000004_too_fast_off.sql` | 너무 빠른 응답 검사 끄기: `min_time_ratio` 0 (팀 결정, 값만 올리면 다시 켜짐) | 2026-11-03 |
| `20261103000003_point_bands.sql` | 포인트 구간 정리: 1문항·3분 이내·3~7분·7~15분·15분 이상 (10·30·60·100·200 / 등록비 절반), `calc_survey_reward`·`calc_survey_price` 교체, `streak_bonus` 20·`community_daily_cap` 10, `submit_response` 너무 빠름 = 예상 시간 × `min_time_ratio` 미만 | 2026-11-03 |
| `20261103000002_community_anon_reply.sql` | 익명 번호·대댓글: `posts.anonymous`·`comments.anonymous`(기본 true, 학생만)·`comments.parent_id`(한 단계), `create_post`·`create_comment`에 `p_anonymous`(+`p_parent_id`), `get_comments` 이름 익명N·익명(글쓴이) + `replies`, 베스트 `best_comment_min`(3) | 2026-11-03 |
| `20261103000001_hot_board.sql` | HOT 게시판: `get_weekly_best`에 월드컵 추가(최근 `weekly_best_days`일 참여 + 댓글), 결과에 `type`(post·worldcup), `weekly_best_count` 3 → 5 | 2026-11-03 |
| `20261102000003_school_ranking.sql` | 학교 대항전 `get_school_ranking` (계열 대항전 대신, 활동 횟수 합계, 활동 학생 `result_min_count` 미만 학교 숨김) | 2026-11-02 |
| `20261102000002_survey_nickname.sql` | 개인 설문 작성자 표시: `surveys.show_nickname`, `set_survey_show_nickname`(켜면 host_name = 닉네임, 인증 ✓은 그대로 false), 닉네임 변경 시 같이 바뀜, 탈퇴하면 지움 | 2026-11-02 |
| `20261102000001_categories.sql` | 설문 카테고리 7개 + 기타 (진로·취업·연애·관계·사회·이슈 추가, 커뮤니티 → 기타) | 2026-11-02 |
| `20261101000005_hub_bookmarks.sql` | 결과 저장 `hub_bookmarks`(함수로만) + `toggle_bookmark`·`get_my_bookmarks` | 2026-11-01 |
| `20261101000004_hub_teaser.sql` | 열람 전 인사이트 1개 `get_hub_teaser` | 2026-11-01 |
| `20261101000003_cross_results.sql` | 교차 분석 `get_cross_results` (기준 문항 답별 묶음, 등록자·열람자만, 소수 묶음 숨김) | 2026-11-01 |
| `20261101000002_worldcup.sql` | 커뮤니티 월드컵: `worldcups`·`worldcup_candidates`·`worldcup_plays`(1인 1회)·`worldcup_matches` (모두 함수로만), 댓글 대상에 `worldcup`. 등록은 `supabase/seed/worldcups.sql` | 2026-11-01 |
| `20261101000001_weekly_best.sql` | 커뮤니티 주간 베스트 `get_weekly_best` + point_rules `weekly_best_days`(7)·`weekly_best_count`(3)·`weekly_best_min`(3) | 2026-11-01 |
| `20261031000003_admin.sql` | 앱 안 운영자 화면: `is_admin`, 대기 건수·신고 처리·의견 답변·단체 승인 함수 (운영자만, 신고자·의견 보낸 사람은 안 보임) | 2026-10-31 |
| `20261031000002_university_domains.sql` | 학교 하나에 메일 주소 여러 개: `university_domains`(로그인 전에도 읽기), 가입 완료 함수가 이 표로 학교를 찾음. 학교 추가는 `supabase/seed/universities.sql` | 2026-10-31 |

테스트 데이터(마이그레이션 아님): `supabase/seed/test_surveys.sql` — 개발용 설문 3개. 정리 SQL은 파일 맨 아래
테스트(마이그레이션 아님): `supabase/seed/test_survey_create.sql` — 설문 등록·4종 응답 확인. 결과를 오류 창에 보여주고 데이터는 남기지 않는다

## 표

### universities — 가입 허용 학교
| 칸 | 설명 |
| --- | --- |
| id | 자동 번호 |
| name | 학교 이름 |
| email_domain | 이메일 도메인 (예: `cau.ac.kr`), 고유 |

처음 데이터: 중앙대학교 `cau.ac.kr`. 학교 추가는 이 표에 한 줄 넣으면 된다. (임시: `docs/PROGRESS.md` "임시로 둔 것" 참고)

### profiles — 회원정보
| 칸 | 설명 |
| --- | --- |
| id | 로그인 계정 id (계정 삭제 시 함께 삭제) |
| account_type | `student` 학생 / `org` 단체 (기업은 단체 종류 "외부") |
| approval_status | 단체 계정 승인용: `pending` 대기 / `approved` 승인 / `rejected` 거절. 학생은 가입 시 바로 `approved` |
| role | `user` / `admin` |
| university_id | 학교 (학생은 필수, 교내 단체는 그 학교, 외부 단체는 비움) |
| nickname | 닉네임, 고유. 학생만 필수 (단체는 비우고 단체 이름을 씀) |
| major_field_id | 전공 계열 (→ `major_fields`). 학과명은 받지 않는다 (2026-10-27, 아래 표 설명 참고) |
| degree_type | 과정: `undergrad` 학부 / `grad` 대학원 |
| admission_year | 입학년도 (예: 2023). 학년은 해마다 바뀌어 저장하지 않는다 |
| terms_agreed_at | 필수 약관(이용약관·개인정보 수집·이용) 동의 시각 |
| gender | 성별 (2026-10-30): `male` / `female` / `undisclosed`(선택 안 함). 비어 있음 = 기능 추가 전 가입 → 마이 탭 "내 정보"에서 입력. 결과에는 묶어서만 (5명 미만 숨김) |
| birth_year | 출생연도 (2026-10-30). 생년월일은 받지 않음(최소 수집). 학생은 가입 때 필수. 나이대로만 사용 |

이메일은 넣지 않는다 (Supabase Auth에만 있음).

### organizations — 단체 정보 (2026-10-27)
단체 계정 1개당 1줄. `id`는 그 단체 계정의 profiles id.
| 칸 | 설명 |
| --- | --- |
| kind | `campus` 교내(학생회·동아리·센터·연구실) / `external` 외부(기업·연구기관) |
| name | 단체 이름. 같은 학교 안에서 중복 불가, 외부 단체끼리 중복 불가 |
| university_id | 교내 단체의 학교 (외부는 비움) |
| evidence_url | 증빙 링크 (공식 SNS·홈페이지) |
| description | 소개 (200자 이하, 비워도 됨) |
| reject_reason | 거절 사유 (운영자가 적음) |

**운영자 승인 방법:** Table Editor → `profiles`에서 그 계정의 `approval_status`를 `approved` 또는 `rejected`로 바꾼다. 거절이면 `organizations.reject_reason`에 사유를 적는다. 거절된 단체는 앱에서 고쳐서 다시 신청할 수 있다.

**승인 전 확인할 것 (2026-10-30):** ① 증빙 링크가 그 단체의 공식 계정·홈페이지인지 ② 단체 이름이 정식 이름인지 ("연구팀"처럼 막연하면 거절). 교내 단체는 설문에 "학교 이름 + 단체 이름"으로 보이므로 이름에 학교를 또 쓸 필요는 없다.

### major_fields — 전공 계열 (2026-10-27)
한국교육개발원 학과 분류 기준. 전국 공통이라 학교가 늘어도 이 목록 하나만 쓴다.
| 칸 | 설명 |
| --- | --- |
| category | 대계열 키: `humanities` `social` `education` `engineering` `natural` `medical` `arts` |
| category_name | 대계열 이름: 인문 / 사회 / 교육 / 공학 / 자연 / 의약 / 예체능 |
| name | 중계열 이름 (35개, 예: 경영·경제, 컴퓨터·통신) |
| sort_order | 화면 표시 순서 |

- 학과명 자유 입력은 표기가 섞여 통계에 못 쓰고, 학교·학과·학번 조합은 재식별 위험이 커서 쓰지 않는다
- 타기팅은 중계열까지, **공개 통계는 대계열까지** (PRD 7번)

### survey_categories — 설문 카테고리 (2026-10-29)
2026-11-02부터 8개: study 학업 · career 진로·취업 · life 생활 · consume 소비·브랜드 · taste 취향·문화 · relation 연애·관계 · society 사회·이슈 · community **기타** (key는 예전 그대로, 이름만 "기타"). `sort_order` 순서로 칩에 나온다. 바꿀 때는 이 표만 고친다 (앱 코드는 표에서 읽음).

### tags · survey_tags — 설문 태그 (2026-11-07)
카테고리(큰 분류 1개)와 따로 세부 주제를 최대 `survey_tag_max`(3)개. `tags`는 운영자가 정한 목록(`name` 고유, `sort_order`, `active`=false면 숨김). `survey_tags`는 (survey_id, tag_id) 기본 키. 앱은 `set_survey_tags`로만 붙인다. 태그 추가는 대시보드에서 `insert into public.tags (name, sort_order) values (...)`

### surveys — 설문 (2026-10-29)
| 칸 | 설명 |
| --- | --- |
| owner_id | 작성자 (단체 설문은 단체 계정. 별도 단체 칸 없음) |
| category_id | 카테고리 |
| title, description | 제목, 설명 |
| question_count, est_minutes | 문항 수, 예상 소요시간(분) |
| reward_points | 응답 1건 보상. **등록 때 서버가 `calc_survey_reward`로 계산해 저장** (규칙이 바뀌어도 이미 올라간 설문의 약속은 유지) |
| target_responses, response_count | 목표 응답 수, 현재 응답 수. 목표에 닿으면 자동 마감 |
| audience | 응답 대상: `all` 전체 / `campus` 우리 학교만 (`university_id` 필수) |
| status | `open` 진행 중 / `closed` 마감 |
| closes_at | 마감 일시 |
| request_id | 등록 요청 번호 (2026-10-30). (owner_id, request_id) 고유 → 등록 버튼 연타·재시도해도 설문 1개 |
| result_visibility, result_university_id | 결과 공개 범위 (2026-10-30): `public` 전체(기본) / `campus` 작성자 학교만(학교를 `result_university_id`에 저장) / `private` 작성자만 — **응답자도 공개 범위를 따른다**. 응답 대상(audience)과 별개. 등록 때 `create_survey`의 `p_result_visibility`로 함께 저장, 나중엔 `set_result_visibility` |
| price_per_response | 등록 때 정한 "응답 1명 받는 값" (2026-10-30). 조기 마감 환불 계산용. 예전 설문·단체 설문은 0 |
| host_name, host_verified | 작성자 표시 (2026-10-30). 단체 설문은 저장될 때 트리거(`surveys_set_host` → `survey_host_name()`)가 승인된 단체 이름 + `true`로 채움. 교내 단체는 "중앙대학교 경영학과 학생회"처럼 학교 이름을 앞에 붙임(이미 들어 있으면 생략). 규칙을 바꿀 때는 `survey_host_name()`만 고친다. 학생 설문은 비움/`false` → 화면에 "개인". 다른 사람은 작성자의 profiles·organizations를 못 읽어서 설문에 따로 저장한다 |

**응답 대상 ≠ 결과 공개 범위.** 응답 대상이 아니면 응답 목록에서 안 보이지만, 결과 열람(데이터 허브)은 별도 공개 설정을 따른다 → 2단계에서 별도 함수로 (예: "응답은 중앙대만, 결과는 전체 공개")

### questions · question_options — 문항·선택지 (2026-10-29)
- questions: `survey_id`, `sort_order`, `type`(`single`/`multi`/`scale`/`text`), `text`, `is_attention_check`·`correct_option_id`(주의 문항)
- **앱은 `id, survey_id, sort_order, type, text`만 읽을 수 있다** (2026-10-30, 칸 단위 권한). 주의 문항 표시·정답은 서버 함수만 쓴다
- 주의 문항: 문항이 `attention_min_questions`개 이상이면 `create_survey`가 가운데쯤에 1개 자동 추가 (5개 보기 중 무작위 정답). 문항 수·소요시간·보상 계산에는 안 넣는다
- 척도(`scale`)는 선택지 없이 1~5 (`answers.scale_value`)
- question_options: `question_id`, `sort_order`, `text`

### responses · answers — 응답·답변 (2026-10-29)
- responses: `survey_id`, `user_id`, `submitted_at`, `status`(`confirmed`/`rejected`), `quality_score`(2단계). **(survey_id, user_id) 고유 → 설문당 1번**
- answers: `response_id`, `question_id`, `option_ids`(배열), `scale_value`, `text_value`. (response_id, question_id) 고유

### survey_views — 데이터 허브 열람 기록 (2026-10-30)
`survey_id`, `user_id`, `paid`(낸 포인트), `free_reason`(`paid` / `one_question` / `official` / `org` / `welcome` 첫 열람 무료), `created_at`. **(survey_id, user_id) 고유 → 한 번만 차감**. 공개 범위를 좁혀도 열람 기록이 있으면 계속 볼 수 있다

### point_rules — 포인트 수치
`key`, `value`, `description`. 값은 `docs/PRD.md` 4-2와 같다. 수치를 바꿀 때는 대시보드에서 이 표만 고친다.

설문 등록 설정값 (2026-10-30): `sec_per_choice` 10초 · `sec_per_text` 40초 · `survey_max_questions` 30 · `survey_max_options` 10 · `survey_min_target`~`survey_max_target` 10~300 (기본 `survey_default_target` 50) · `survey_max_days` 14 (기본 `survey_default_days` 7) · `attention_min_questions` 5 · `answer_text_max` 500 · `cost_survey_create_org` 0 (임시, Q14)

포인트 구조 (2026-10-30 변경, `20261030000005`): 응답 보상(앱 지급) `reward_1q` 10 · `reward_lt5` 30 · `reward_5to15` 80 · `reward_gte15` 150. 등록비 = 1명당 값 × 목표 인원, 1명당 값 `price_1q` 5 · `price_lt5` 15 · `price_5to15` 40 · `price_gte15` 75. 열람료 `cost_data_view` 100, 등록자 분배율 `data_share_rate` 0.4. `cost_survey_create`(700)는 더 이상 쓰지 않음

포인트 구간 (2026-11-03 변경, `20261103000003`): 예상 시간 구간 1문항 / 3분 이내 / 3~7분 / 7~15분 / 15분 이상 → 응답 보상 `reward_1q` 10 · `reward_le3` 30 · `reward_3to7` 60 · `reward_7to15` 100 · `reward_gte15` 200, 1명당 등록비 `price_1q` 5 · `price_le3` 15 · `price_3to7` 30 · `price_7to15` 50 · `price_gte15` 100 (보상의 절반). `streak_bonus` 20 · `community_daily_cap` 10. 너무 빠른 응답 = 예상 시간 × `min_time_ratio` 미만 (2026-11-03 팀 결정으로 0 = 끔, `20261103000004`). `reward_lt5`·`reward_5to15`·`price_lt5`·`price_5to15`·`min_seconds_per_question`·`balance_vote`·`balance_daily_cap`·`early_bird_rate`·`cost_survey_create`는 사용 안 함. 앱의 구간 기준은 `src/lib/pointBands.ts` (서버와 같게)

### point_ledger — 포인트 기록
| 칸 | 설명 |
| --- | --- |
| user_id | 누구의 기록인지 |
| amount | 적립은 +, 차감은 − (0 불가) |
| status | `pending` / `confirmed` / `rejected` / `revoked` |
| reason | `welcome` / `survey_reward` / `survey_create` / `survey_refund`(조기 마감 환불) / `data_view` / `data_share`(열람 수익) / `balance_vote` |
| ref_id | 어떤 설문·게시물인지 (웰컴은 비움) |

- 잔액 = `confirmed` 합계. 잔액 칸은 없다
- **중복 방지**: `(user_id, reason, ref_id)` 고유. 웰컴은 사람당 1번, 같은 대상 보상도 1번

## 권한 (RLS)

| 표 | 앱에서 읽기 | 앱에서 쓰기 |
| --- | --- | --- |
| universities | 누구나 (로그인 전 포함, 가입 화면용) | 불가 |
| profiles | 본인 행만 | 불가 (서버 함수로만) |
| organizations | 본인 단체만 | 불가 (서버 함수로만, 승인은 대시보드) |
| major_fields | 로그인한 사람 모두 | 불가 |
| survey_categories | 로그인한 사람 모두 | 불가 |
| tags | 로그인한 사람 모두 (active만) | 불가 |
| survey_tags | 그 설문을 볼 수 있는 사람 | 불가 (`set_survey_tags`로만) |
| surveys | 응답 대상(전체 / 같은 학교) + 작성자 본인 | 불가 (서버 함수로만) |
| questions, question_options | 그 설문을 볼 수 있는 사람 | 불가 |
| responses, answers | 본인 것만 | 불가 (`submit_response`로만) |
| point_rules | 로그인한 사람 모두 | 불가 (대시보드에서 운영자) |
| point_ledger | 본인 기록만 | 불가 (서버 함수로만) |
| survey_views | 본인 열람 기록만 | 불가 (`view_survey`로만) |

로그인 안 한 상태(anon)는 universities 말고는 아무 표도 못 읽는다.

## 서버 함수

| 함수 | 하는 일 | 누가 |
| --- | --- | --- |
| `get_my_balance()` | 본인 잔액 (confirmed 합계) | 로그인한 사람 |
| `set_survey_tags(p_survey_id, p_tag_ids)` | 내 설문의 태그를 통째로 바꿈 (중복 제거, 최대 `survey_tag_max`, 쓰는 태그만). 오류 `not_survey_owner`·`too_many_tags`·`tag_not_found` (2026-11-07) | 설문 작성자 |
| `update_my_demographics(p_gender, p_birth_year)` | 본인 성별·출생연도 **한 번만** 입력 (기존 회원용, 비어 있는 칸만 채움. 둘 다 있으면 `demographics_locked`). 고치려면 운영자가 대시보드에서 (2026-10-30) | 학생 |
| `complete_signup(p_nickname, p_major_field_id, p_admission_year, p_degree_type, p_terms_agreed, p_gender, p_birth_year)` | 학교 도메인 검사 → 학생 회원정보 저장 → 웰컴 포인트 지급. 이미 가입했으면 아무것도 안 함 | 로그인한 사람 (이메일 인증 완료) |
| `request_org_signup(...)` | 단체 신청·재신청 → 승인 대기. 포인트 없음 | 로그인한 사람 (이메일 인증 완료) |
| `calc_survey_reward(문항 수, 소요분)` | `point_rules`로 응답 1건 보상 계산 (1문항 / 3분 이내 / 3~7분 / 7~15분 / 15분 이상, 2026-11-03) | 로그인한 사람 (설문 등록 때 서버가 사용) |
| `submit_response(p_survey_id, p_answers, p_duration_seconds)` | (2026-10-31) 너무 빠르면 반려, 결과에 `reason` 추가 · 이전 설명: 응답 제출 + 보상 지급 + 응답 수 +1 + 목표 도달 시 마감. **`{ reward, passed }`를 돌려줌** (2026-10-30). 확인 문항을 틀리면 응답은 `rejected`, 보상 0, 응답 수 그대로 → 다시 응답하면 이전 반려 응답을 지우고 새로 받음. `p_duration_seconds`(걸린 초)는 참고용 저장 | 학생 |
| `set_result_visibility(p_survey_id, p_visibility)` | 결과 공개 범위 바꾸기 (`invalid_visibility`: 값이 틀렸거나 학교 없는 계정이 campus) (2026-10-30) | 작성자 본인 |
| `calc_survey_price(문항 수, 소요분)` | 응답 1명 받는 값 (`calc_survey_reward`와 같은 구간) | 서버 함수 안에서 사용 |
| `create_survey(...)` | 설문 등록: 검사 → 소요시간·보상 계산 → 설문·문항·주의 문항 저장 → 등록 비용 차감을 한 번에. 설문 번호를 돌려줌 (2026-10-30) | 학생, 승인된 단체 |
| `point_rule(p_key)` | `point_rules` 값 하나 (없으면 `rule_missing`) | 서버 함수 안에서 사용 |
| `get_survey_results(p_survey_id)` | 문항별 집계 결과 (2026-10-30). **유효 응답** = 확인 문항 정답을 고른 응답(확인 문항이 없으면 전부). `{ total, excluded, questions: [{ id, type, text, answered, options[{id,text,count}], scale{avg,counts[5]}, texts[] }] }`. 확인 문항은 빼고, 응답자 정보는 넣지 않는다. 응답 1개부터 | 작성자 본인 |
| `close_survey(p_survey_id)` | 응답 마감 (status → closed) + **못 받은 인원 × 1명당 값 환불** (`survey_refund`, 설문당 1번). 이미 마감이면 그대로. 다시 열기 없음 (2026-10-30) | 작성자 본인 |
| `delete_survey(p_survey_id)` | **정상 응답 0명일 때만** 설문 삭제 (확인 문항 오답 응답은 함께 지워짐, `20261110000003`) + 등록비 − 이미 받은 환불만큼 돌려줌 (`survey_delete`). 문항·보기·태그·홍보 글은 함께 삭제. 돌려준 금액 반환 (2026-11-10) | 작성자 본인 |
| `get_survey_for_copy(p_survey_id)` | 다시 고치기용 문항·보기 (확인 문항 제외) `[{type, text, options[]}]` (2026-11-10) | 작성자 본인 |
| `get_hub_list(p_category, p_sort)` | 데이터 허브 목록 (popular·latest·responses). 열람함·응답함·무료·신뢰도·참고용 표시 (2026-10-30) | 로그인한 사람 |
| `get_hub_preview(p_survey_id)` | 무료 정보: 설문 정보·문항 목록·응답자 구성(5명 미만 숨김)·열람 상태·무료 이유·가격 | 볼 수 있는 사람 |
| `get_my_comparison(p_survey_id)` | 내 답 비교 (문항별 내 답과 같은 답 비율, 주관식 제외) | 그 설문 응답자 |
| `view_survey(p_survey_id)` | 전체 열람: 무료 이유가 없으면 `cost_data_view` 차감 → 등록자에게 `data_share_rate` 분배 → `survey_views` 기록. 한 번만. 회원정보 행 잠금 | 볼 수 있는 사람 |
| `get_full_results(p_survey_id)` | 전체 결과: 문항별 집계 + 계열·학년·성별·나이대 나눠 보기(5명 미만 그룹 숨김) + 신뢰 정보. 주관식 원문 없음 | 작성자, 열람한 사람 |
| `get_survey_raw(p_survey_id)` | 원본 CSV: 응답 한 명 = 한 줄 (계열·학년·성별·나이대 + 문항별 답 글자). 이름·이메일·학교·출생연도·응답 시각·사용자 번호 없음, 줄 순서 섞음, 5명 미만 그룹 이름은 "5명 미만" | 작성자만 |
| `get_my_views()` | 내가 열람한 설문 목록 (설문 번호·제목·주최·열람 날짜·낸 포인트), 최신순. 다른 학교 "우리 학교만" 설문도 열람했으면 제목이 보인다 | 본인 |
| `report_survey(p_survey_id, p_reason, p_detail)` | 설문 신고 (사유 spam·abuse·privacy·sexual·other, 설명 200자). 본인 설문·중복 거절. 확인 전 신고가 `report_hide_count`(3)명 이상이면 `moderation = hidden` | 로그인한 사람 |
| `delete_my_account()` | 회원 탈퇴. 진행 중인 내 설문 마감, "나만 보기" 설문 삭제, 계정 삭제 → 회원정보·포인트·신고·단체 정보 삭제, 응답·설문·열람 기록은 사람 연결만 비워 남김 | 본인 |
| `send_feedback(p_category, p_body, p_screen, p_device)` | 의견 보내기 (종류 bug·inconvenience·idea·other, 내용 1~1000자, 화면·기기 정보). 하루 `feedback_daily_max`(10)건 | 로그인한 사람 |
| `get_today_daily()` | 오늘(한국 시간)의 질문, 내 선택, A·B 수·그룹별 결과(답한 뒤에만), 연속 일수, 댓글 수, 포인트 설정값. 질문이 없으면 null | 로그인한 사람 |
| `answer_daily(p_choice)` | 오늘의 질문에 a/b로 답하기. 학생은 출석 포인트 + 연속 보너스. 한 질문 한 번 (`already_answered`) | 로그인한 사람 |
| `create_post(p_kind, p_question, p_options)` | 투표 글 만들기 (질문 100자, 보기 30자·2~4개·중복 불가, 나만 그래?는 보기 고정). 하루 `post_daily_max`개 | 로그인한 사람 |
| `vote_post(p_post_id, p_choice)` | 투표 (한 글 한 표). 학생·남의 글이면 `community_vote`P, 커뮤니티 하루 합산 `community_daily_cap`. 투표 `creator_bonus_every`개마다 학생 작성자 `creator_bonus`P | 로그인한 사람 |
| `get_feed(p_kind, p_sort)` | 숨긴 글 빼고 50개 (popular·latest). 비율은 투표했거나 내 글일 때만 | 로그인한 사람 |
| `get_post(p_post_id)` | 글 하나 + (투표했거나 내 글이면) 비율과 계열·학년·성별·나이대 그룹 (5명 미만 숨김) | 로그인한 사람 |
| `create_post(p_kind, p_question, p_options, p_body)` | (2-1에서 본문 추가) | 로그인한 사람 |
| `update_post_body(p_post_id, p_body)` / `delete_post(p_post_id)` | 내 글 본문 수정(500자) / 삭제(`moderation = deleted`, 포인트는 그대로) | 작성자 |
| `create_comment(p_type, p_id, p_body)` / `delete_comment(p_comment_id)` | 댓글 (`post`·`daily`, 200자, 하루 `comment_daily_max`개) / 내 댓글 삭제 | 로그인한 사람 / 작성자 |
| `like_comment(p_comment_id)` | 좋아요 누르기·취소 (내 댓글 불가) | 로그인한 사람 |
| `get_comments(p_type, p_id)` | `{ best: 좋아요 많은 3개, all: 오래된 순 }` | 로그인한 사람 |
| `create_post(…, p_body, p_anonymous)` / `create_comment(p_type, p_id, p_body, p_parent_id, p_anonymous)` | (2026-11-03) 익명 기본 true, 운영자·단체는 항상 false로 저장. 답글은 같은 글의 보이는 원댓글에만 (아니면 `comment_not_found`) | 로그인한 사람 |
| `get_comments(p_type, p_id)` (2026-11-03) | `{ best: 공감 ≥ best_comment_min 최대 3, all: 원댓글 오래된 순 + replies[] }`. 댓글 `{id, parent_id, deleted, body, author, mine, likes, liked, created_at}`. author = 익명N(그 글에서 처음 익명 댓글 단 순서, 지운 것도 셈)·익명(글쓴이)·닉네임·단체 이름. 지운 원댓글은 답글이 있으면 `deleted`로 자리만. 글 이름은 `post_author_name`(익명/닉네임/단체) | 로그인한 사람 |
| `set_survey_show_nickname(p_survey_id, p_show)` | 내 개인 설문의 작성자 표시: 닉네임 공개 ↔ 비공개(앱에서 "옛썰러"). 학생 등록자만(`nickname_student_only`, 남의 설문 `survey_not_found`) | 학생 등록자 |
| `get_school_ranking()` | 이번 주(한국 시간 월요일부터) 학교별 활동 횟수 합계(투표·오늘의 질문·글·댓글·월드컵, 학생만) 순위 + 내 학교 순위. 활동한 학생이 `result_min_count` 미만인 학교는 뺌. `get_major_ranking`은 남아 있지만 앱에서 안 씀 | 로그인한 사람 |
| `get_weekly_best()` | HOT 게시판 (2026-11-03). 글: 최근 `weekly_best_days`일 안 글의 투표 + 보이는 댓글 (홍보글은 설문이 열려 있을 때만). 월드컵: 최근 `weekly_best_days`일 안 참여 + 보이는 댓글. 합이 `weekly_best_min` 이상인 것 `weekly_best_count`개 (많은 순 → 최신). `[{type: post|worldcup, id, kind, question, votes, comment_count, created_at}]` (created_at 2026-11-10 추가, 월드컵은 kind `worldcup`, question = 제목, votes = 참여 수), 작성자 없음 | 로그인한 사람 |
| `toggle_bookmark(p_survey_id)` | 결과 저장 ↔ 해제, 저장 상태면 true. 데이터 탭에 보이는 설문만(`not_listed`) | 로그인한 사람 |
| `get_my_bookmarks()` | 내가 저장한 설문 번호 배열 (최근 순) | 로그인한 사람 |
| `get_hub_teaser(p_survey_id)` | 열람 전 미리보기: 하나 고르기 문항 중 1위 비율이 가장 높은 것 `{index, question, option, pct}`. 목록에 보이는 설문(`survey_listed`)만, 아니면 null | 로그인한 사람 |
| `get_cross_results(p_survey_id, p_question_id)` | 기준 문항(하나 고르기·척도)의 답별로 다른 문항 집계 `{question_id, groups:[{label, n, hidden, questions}]}` (그룹과 같은 모양). 등록자 또는 열람한 사람(`not_viewed`), 유효 응답만, `result_min_count` 미만 묶음 숨김 | 등록자·열람자 |
| `get_worldcups()` | 월드컵 목록 최신순 `[{id, title, size, plays, played}]` | 로그인한 사람 |
| `get_worldcup(p_id)` | 월드컵 하나 + 후보 `{…, played, candidates:[{id,name}]}` | 로그인한 사람 |
| `submit_worldcup(p_id, p_matches)` | 한 판 결과 `[{winner, loser}]` 검사·저장 (첫 판만, `already_played`). 학생이면 `community_vote`P (커뮤니티 하루 `community_daily_cap` 안, ref `worldcup:<id>`) | 로그인한 사람 |
| `get_worldcup_result(p_id)` | 한 판 끝낸 뒤에만(`not_played`): 우승 비율·1:1 승률 랭킹, 계열별·성별 1위(`result_min_count` 미만 숨김), 참여 수. 누가 뭘 골랐는지 없음 | 로그인한 사람 |
| `report_content(p_type, p_id, p_reason, p_detail)` | 설문·글·댓글 신고 (설문은 `report_survey`로). `report_hide_count`명이면 자동 숨김 | 로그인한 사람 |
| `change_nickname(p_nickname)` | 닉네임 바꾸기 (학생만, 2~12자, 금칙어·중복 불가, `nickname_change_days`일에 한 번) | 학생 |
| `create_promo(p_survey_id, p_question, p_body)` | 내 진행 중 설문 홍보글 (한 줄 소개 100자 + 본문 500자, 설문 하나에 하나 `promo_exists`, 하루 글 수에 포함) | 설문 등록자 |
| `get_promotable_surveys()` | 홍보할 수 있는 내 설문 (진행 중, 아직 홍보 안 함) | 로그인한 사람 |
| `get_major_ranking()` | 이번 주(한국 시간 월요일부터) 계열별 참여 수 순위 + 내 계열 순위. 투표·오늘의 질문·글·댓글, 미입력 제외 | 로그인한 사람 |
| `get_my_invite()` | 내 초대 코드(처음 열 때 생성), 초대 인원, 코드 입력 가능 여부(가입 `invite_window_days`일 안·웰컴 받은 계정·아직 안 함) | 학생 |
| `redeem_invite(p_code)` | 친구 코드 입력 → 나 `invite_reward_invitee`P, 초대한 사람 `invite_reward_inviter`P (30일 `invite_monthly_max`명까지) | 학생 |
| `is_admin()` | 지금 로그인한 사람이 운영자(`profiles.role = 'admin'`)인지 | 로그인한 사람 |
| `admin_get_counts()` | 처리 대기 건수 `{reports(대상 수), feedback, orgs}` | 운영자 |
| `admin_get_reports()` | 확인 전 신고를 대상별로 묶어서: 종류·번호·신고 수·사유·상세(최근 3개)·대상 내용·지금 상태. 신고한 사람은 없음 | 운영자 |
| `admin_resolve_report(p_type, p_id, p_action)` | `keep` 문제없음(숨김이면 다시 보이게, 신고 kept) / `remove` 삭제(moderation removed, 신고 removed). 닫은 신고 수를 돌려줌 (이미 처리했으면 0) | 운영자 |
| `admin_get_feedback()` | 답변 전 의견 (보낸 사람 없음) | 운영자 |
| `admin_reply_feedback(p_id, p_reply, p_status)` | 답변 쓰기 (`answered` 답변함 / `done` 반영함, 1~1000자) | 운영자 |
| `admin_get_pending_orgs()` | 승인 대기 단체 (이름·종류·학교·증빙 링크·소개·가입 메일) | 운영자 |
| `admin_decide_org(p_user_id, p_approve, p_reason)` | 승인 / 거절(사유 필수 200자) | 운영자 |
| `is_email_registered(p_email)` | 그 메일로 **가입을 마친** 계정이 있으면 true (회원정보 없는 반쪽 계정은 false). 예/아니오만 돌려줌 | 누구나 (로그인 전 포함) |

### complete_signup 입력 규칙

- `p_nickname`: 앞뒤 공백 제거 후 2~12자, 다른 회원과 겹치면 안 됨
- `p_major_field_id`: `major_fields`에 있는 id (중계열)
- `p_degree_type`: `undergrad`(학부) / `grad`(대학원)
- `p_admission_year`: 2000 ~ 올해
- `p_terms_agreed`: 반드시 `true` (필수 약관 동의)
- `p_gender`: `male` / `female` / `undisclosed` (2026-10-30)
- `p_birth_year`: 올해-60 ~ 올해-14 (2026-10-30)

### request_org_signup 입력 규칙 (2026-10-27)

`request_org_signup(p_kind, p_name, p_university_id, p_evidence_url, p_description, p_terms_agreed)`
단체 신청. profiles(`org`, `pending`)와 organizations에 저장. **포인트 지급 없음.**
이미 학생이면 거부, 대기·승인 상태면 아무것도 안 함, 거절 상태면 내용을 고쳐 다시 대기로.

- `p_kind`: `campus` / `external`
- `p_name`: 앞뒤 공백 제거 후 2~30자
- `p_university_id`: 교내면 필수 (외부면 무시)
- `p_evidence_url`: `http://` 또는 `https://`로 시작, 300자 이하
- `p_description`: 200자 이하, 비워도 됨
- `p_terms_agreed`: 반드시 `true`

### create_survey 입력 규칙 (2026-10-30)

`create_survey(p_request_id, p_category_id, p_title, p_description, p_audience, p_target, p_days, p_questions)`

- `p_request_id`: 작성 화면을 열 때 만든 uuid. 같은 번호로 다시 부르면 처음 만든 설문 번호만 돌려주고 비용을 다시 빼지 않는다
- `p_title`: 2~60자 / `p_description`: 500자 이하, 비워도 됨
- `p_audience`: `all` / `campus` (campus는 내 학교가 있어야 함)
- `p_target`: `survey_min_target`~`survey_max_target` / `p_days`: 1~`survey_max_days`
- `p_questions`: 1~`survey_max_questions`개. 문항 1~200자, single·multi는 선택지 2~`survey_max_options`개(각 1~100자)
  `[{"type":"single","text":"…","options":["…","…"]}, {"type":"scale","text":"…"}, {"type":"text","text":"…"}]`
- 소요시간 = 고르는 문항 × `sec_per_choice` + 주관식 × `sec_per_text`, 분으로 올림(최소 1분). 보상 = `calc_survey_reward`
- 비용: 학생 = `calc_survey_price` × 목표 인원 (2026-10-30), 단체 = `cost_survey_create_org`. 잔액 부족이면 거절. 회원정보 행을 잠가 동시 등록에도 음수 불가
- ⚠️ 앞으로 포인트를 빼는 함수(데이터 열람 등)도 **잔액 확인 전에 `profiles` 본인 행을 `for update`로 잠근다.** 그래야 서로 다른 차감이 동시에 와도 음수가 안 된다

### submit_response 답 형식 (2026-10-30)

`[{"question_id":1,"option_ids":[3]}, {"question_id":2,"option_ids":[7,8]}, {"question_id":3,"scale_value":4}, {"question_id":4,"text_value":"…"}]`
단일은 1개, 복수는 1개 이상, 척도 1~5, 주관식 1~`answer_text_max`자. 예전 형식 `"option_id": 3`도 받는다.

### 서버 함수 오류 코드

| 코드 | 뜻 |
| --- | --- |
| `not_authenticated` | 로그인 안 됨 |
| `email_not_verified` | 이메일 인증 안 됨 |
| `domain_not_allowed` | 허용 학교 이메일이 아님 |
| `invalid_nickname` | 닉네임 2~12자 아님 |
| `nickname_taken` | 이미 쓰는 닉네임 |
| `invalid_major_field` | 전공 계열이 없거나 잘못됨 |
| `invalid_degree_type` | 과정 값이 잘못됨 |
| `invalid_admission_year` | 입학년도 값이 잘못됨 |
| `terms_not_agreed` | 필수 약관에 동의하지 않음 |
| `rule_missing` | `point_rules`에 필요한 값이 없음 (운영 문제) |
| `already_student` | 이미 학생으로 가입한 계정이라 단체 신청 불가 |
| `invalid_org_kind` | 단체 종류 값이 잘못됨 |
| `invalid_org_name` | 단체 이름 2~30자 아님 |
| `invalid_org_university` | 교내 단체인데 학교가 없거나 잘못됨 |
| `invalid_org_evidence` | 증빙 링크가 http(s)로 시작하지 않거나 너무 김 |
| `invalid_org_description` | 소개가 200자 초과 |
| `org_name_taken` | 같은 학교(또는 외부 단체) 안에 같은 이름이 있음 |
| `not_student` | 학생 계정이 아님 (단체는 응답 불가) |
| `survey_not_found` | 설문이 없거나 볼 수 없음 |
| `own_survey` | 본인 설문에는 응답 불가 |
| `survey_closed` | 마감된 설문 (상태 마감 또는 마감일 지남) |
| `survey_full` | 목표 응답 수에 도달 |
| `not_target` | 응답 대상이 아님 (우리 학교 설문) |
| `already_responded` | 이미 응답한 설문 |
| `invalid_answers` | 답이 빠졌거나 다른 문항의 선택지, 척도·주관식 범위 밖 |
| `invalid_request` | 등록 요청 번호가 없음 |
| `org_not_approved` | 승인 전 단체는 설문 등록 불가 |
| `not_allowed` | 설문을 등록할 수 없는 계정 |
| `invalid_title` | 제목 2~60자 아님 |
| `invalid_description` | 설명 500자 초과 |
| `invalid_category` | 카테고리가 없음 |
| `invalid_audience` | 응답 대상 값이 잘못됐거나, 학교가 없는데 우리 학교만 선택 |
| `invalid_target` | 목표 응답 수가 범위 밖 |
| `invalid_days` | 마감 일수가 범위 밖 |
| `invalid_questions` | 문항 수·종류·내용·선택지가 규칙에 안 맞음 |
| `insufficient_points` | 등록 비용보다 잔액이 적음 |
| `not_owner` | 내 설문이 아님 (결과 보기·마감·공개 범위) |
| `invalid_visibility` | 공개 범위 값이 틀렸거나, 학교 없는 계정이 "우리 학교만" 선택 |
| `invalid_gender` | 성별 값이 잘못됨 |
| `invalid_birth_year` | 출생연도가 비었거나 범위 밖 |
| `demographics_locked` | 성별·출생연도를 이미 입력함 (고치려면 문의) |
| `org_must_publish` | 단체 설문을 "나만 보기"로 등록·변경하려 함 (테스트 기간 결과 공개 조건) |
| `report_own_survey` | 내 설문을 신고하려 함 |
| `already_reported` | 같은 설문을 이미 신고함 |
| `invalid_reason` | 신고 사유가 목록에 없음 |
| `survey_hidden` | 신고로 숨긴(또는 삭제한) 설문에 응답하려 함 |
| `invalid_feedback` | 의견 종류나 내용이 비었거나 너무 김 |
| `feedback_limit` | 의견을 하루 최대 건수만큼 보냄 |
| `invalid_choice` | 오늘의 질문 보기가 a·b가 아님 |
| `no_daily` | 오늘 예약된 질문이 없음 |
| `already_answered` | 오늘의 질문에 이미 답함 |
| `invalid_post` | 글의 질문·보기가 규칙에 안 맞음 |
| `post_limit` | 커뮤니티 글을 하루 최대만큼 만듦 |
| `post_not_found` | 없거나 숨겨진 글 |
| `already_voted` | 이 글에 이미 투표함 |
| `promo_exists` | 이 설문의 홍보글이 이미 있음 |
| `invalid_invite` | 없는 코드 또는 내 코드 |
| `invite_used` | 이미 초대 코드를 입력함 |
| `invite_expired` | 입력 기간이 지났거나 웰컴을 받지 않은 계정(재가입) |
| `invite_student_only` | 단체 계정 |
| `invalid_comment` | 댓글이 비었거나 200자 넘음 |
| `comment_limit` | 댓글을 하루 최대만큼 담 |
| `comment_not_found` | 없거나 숨겨진 댓글 (남의 댓글 삭제 포함) |
| `own_comment` | 내 댓글에 좋아요 |
| `banned_word` | 글·댓글·닉네임에 금칙어 |
| `nickname_cooldown` | 닉네임을 바꾼 지 얼마 안 됨 |
| `nickname_student_only` | 단체 계정이 닉네임을 바꾸려 함 |
| `not_listed` | 데이터 허브에서 볼 수 없는 결과 (공개 범위·마감·응답 수 조건) |
| `not_respondent` | 내 답 비교는 그 설문에 응답한 사람만 |
| `not_viewed` | 전체 결과는 열람한 뒤에 (view_survey 먼저) |
| `not_admin` | 운영자 함수를 운영자가 아닌 계정이 부름 |
| `invalid_request` | 운영자 함수에 틀린 종류·처리 값 |
| `reply_empty` / `reply_too_long` | 의견 답변이 비었거나 1000자 넘음 |
| `feedback_not_found` | 없는 의견 |
| `reject_reason_required` / `reject_reason_too_long` | 단체 거절 사유가 비었거나 200자 넘음 |
| `org_not_pending` | 이미 승인·거절한 단체 |
| `invalid_cross` | 교차 분석 기준이 하나 고르기·척도가 아니거나 다른 설문 문항 |
| `worldcup_not_found` | 없는 월드컵 |
| `already_played` | 이미 집계된 월드컵 (다시 하기는 앱에서만) |
| `not_played` | 월드컵 결과는 한 판 끝낸 뒤에 |
| `invalid_bracket` | 월드컵 대진이 맞지 않음 (매치 수·후보·진 후보 재등장) |

## 푸시 알림 (2026-11-10, `20261110000007_push.sql`)

- `push_tokens` (token PK · user_id · platform): 기기 알림 주소. RLS 켬 + 정책 없음 → 앱은 직접 못 읽고 못 씀. `register_push_token(p_token, p_platform)` · `unregister_push_token(p_token)`(내 것만)으로만
- `profiles.notify_daily` (기본 true): 오늘의 질문 알림 켜기/끄기. `set_notify_daily(p_on)`
- `notifications` (user_id · kind `daily` · day · title · body · url · read_at): 보낸 알림 기록 (나중에 알림함). 본인 것만 읽기. `unique (user_id, kind, day)` → 같은 날 두 번 실행돼도 한 번만
- `send_daily_push()`: pg_cron `daily-question-push` 매일 03:00 UTC(한국 12시). 오늘 질문에 안 답한 + 알림 켠 + 기기 있는 사람 → 기록 남기고 pg_net으로 Expo 푸시 서버에 100개씩. 앱에서 부를 수 없음
- 직접 보내 보기 (테스트): SQL Editor에서 `select public.send_daily_push();` (오늘 이미 보냈으면 0) · 결과 확인: `select * from net._http_response order by created desc limit 5;`
- 탈퇴하면 auth.users 삭제 → profiles와 함께 알림 주소·기록도 지워짐

## 신고 처리 (운영자, 2026-10-30)

> 2026-10-31부터: 팀 운영자 계정으로 앱 → 마이 탭 맨 위 **🛠 운영** 카드에서 처리할 수 있다. 아래는 Supabase에서 직접 할 때

1. Table Editor → `reports`에서 `status = pending`인 신고를 본다 (`target_id` = 설문 번호)
2. `surveys`에서 그 설문을 열어 내용을 확인한다 (`moderation`이 `hidden`이면 신고 3건으로 자동 숨김된 상태)
3. 문제없음: 설문 `moderation` → `visible`, 그 설문의 신고 `status` → `kept`
4. 문제있음: 설문 `moderation` → `removed`, 신고 `status` → `removed`
5. 포인트는 건드리지 않는다 (이미 준 응답 보상 유지, 등록비 환불 없음)

## 제휴·광고 문의 확인 (운영자, 2026-11-07)
Table Editor → `partnership_inquiries`. 담당자에게 전화·메일로 연락한 뒤 `status`를 `answered`(연락함) 또는 `done`(처리 끝)으로. 문의자는 앱 "제휴·광고 문의" 화면 아래 "내가 보낸 문의"에서 상태를 본다. 접수 1년 뒤 자동 삭제

## 보상 연락처 (운영자, 2026-11-07)
응답자가 "지워 달라"고 의견을 보내면: `delete from public.reward_contacts where survey_id = <설문 번호> and user_id = '<회원 id>';` · 작성자가 번호를 다른 용도로 쓴다는 신고가 오면 그 설문의 `survey_rewards` 행을 지우고(더 이상 수집 안 됨) 계정 제한 검토. 남긴 날 30일 뒤 자동 삭제

## 의견 답변 (운영자, 2026-10-30)

1. Table Editor → `feedback`에서 `status = pending`인 의견을 본다 (`screen` = 보낸 화면, `device` = 기기·앱 버전)
2. `reply`에 답변을 쓰고, `status`를 `answered`(답변함) 또는 `done`(반영함)으로, `replied_at`에 지금 시각
3. 보낸 사람은 앱의 "의견 보내기 → 내가 보낸 의견"에서 답변을 본다

## 월드컵 등록 (운영자, 2026-11-01)

`supabase/seed/worldcups.sql`의 블록 하나를 복사해 제목·설명·후보(8개 또는 16개)만 바꿔 SQL Editor에서 Run. 가장 최근 월드컵이 커뮤니티 '전체' 위쪽 카드에 나온다. 지우기: Table Editor → `worldcups`에서 행 삭제 (후보·참여·매치가 같이 지워짐)

## 포인트 경제 확인 (운영자, 2026-11-03)

테스트 1주차·2주차에 SQL Editor에서 실행해 보고 `point_rules` 값을 조정한다. 보는 것: 설문이 목표 인원을 잘 채우는지(응답자 부족), 커뮤니티·출석이 설문 응답보다 많이 생기지 않는지, 잔액이 한쪽에 쏠리지 않는지.

```sql
-- 1. 최근 7일 이유별 생김·사라짐
select reason, sum(amount) filter (where amount > 0) as 생김, -sum(amount) filter (where amount < 0) as 사라짐, count(*) as 건수
  from public.point_ledger
 where status = 'confirmed' and created_at >= now() - interval '7 days'
 group by reason order by 생김 desc nulls last;

-- 2. 최근 14일 마감된 설문의 목표 달성률
select count(*) as 마감, round(avg(least(response_count::numeric / target_responses, 1)) * 100) as 평균_달성률,
       count(*) filter (where response_count >= target_responses) as 목표_채움
  from public.surveys
 where status = 'closed' and created_at >= now() - interval '14 days';

-- 3. 학생 잔액 분포 (25% · 50% · 75% · 90%)
with b as (
  select p.id, coalesce(sum(l.amount) filter (where l.status = 'confirmed'), 0) as bal
    from public.profiles p left join public.point_ledger l on l.user_id = p.id
   where p.account_type = 'student' group by p.id)
select percentile_cont(array[0.25, 0.5, 0.75, 0.9]) within group (order by bal) as 분포, max(bal) as 최대, count(*) as 학생
  from b;
```

## 금칙어 추가 (운영자, 2026-10-30)

Table Editor → `banned_words`에 한 줄 추가: `word`(띄어쓰기 없이), `scope` = `all`(글·댓글·닉네임) 또는 `nickname`(닉네임만, 사칭 방지). 바로 적용된다. 이미 올라간 글은 바뀌지 않으니 신고 처리로
