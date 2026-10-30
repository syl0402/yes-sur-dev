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
`key`(study/life/consume/taste/community), `name`(학업·생활·소비·취향·커뮤니티), `sort_order`. 바꿀 때는 이 표만 고친다.

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
| `update_my_demographics(p_gender, p_birth_year)` | 본인 성별·출생연도 **한 번만** 입력 (기존 회원용, 비어 있는 칸만 채움. 둘 다 있으면 `demographics_locked`). 고치려면 운영자가 대시보드에서 (2026-10-30) | 학생 |
| `complete_signup(p_nickname, p_major_field_id, p_admission_year, p_degree_type, p_terms_agreed, p_gender, p_birth_year)` | 학교 도메인 검사 → 학생 회원정보 저장 → 웰컴 포인트 지급. 이미 가입했으면 아무것도 안 함 | 로그인한 사람 (이메일 인증 완료) |
| `request_org_signup(...)` | 단체 신청·재신청 → 승인 대기. 포인트 없음 | 로그인한 사람 (이메일 인증 완료) |
| `calc_survey_reward(문항 수, 소요분)` | `point_rules`로 응답 1건 보상 계산 (1문항 / 5분 미만 / 5~15분 / 15분 이상) | 로그인한 사람 (설문 등록 때 서버가 사용) |
| `submit_response(p_survey_id, p_answers, p_duration_seconds)` | 응답 제출 + 보상 지급 + 응답 수 +1 + 목표 도달 시 마감. **`{ reward, passed }`를 돌려줌** (2026-10-30). 확인 문항을 틀리면 응답은 `rejected`, 보상 0, 응답 수 그대로 → 다시 응답하면 이전 반려 응답을 지우고 새로 받음. `p_duration_seconds`(걸린 초)는 참고용 저장 | 학생 |
| `set_result_visibility(p_survey_id, p_visibility)` | 결과 공개 범위 바꾸기 (`invalid_visibility`: 값이 틀렸거나 학교 없는 계정이 campus) (2026-10-30) | 작성자 본인 |
| `calc_survey_price(문항 수, 소요분)` | 응답 1명 받는 값 (`calc_survey_reward`와 같은 구간) | 서버 함수 안에서 사용 |
| `create_survey(...)` | 설문 등록: 검사 → 소요시간·보상 계산 → 설문·문항·주의 문항 저장 → 등록 비용 차감을 한 번에. 설문 번호를 돌려줌 (2026-10-30) | 학생, 승인된 단체 |
| `point_rule(p_key)` | `point_rules` 값 하나 (없으면 `rule_missing`) | 서버 함수 안에서 사용 |
| `get_survey_results(p_survey_id)` | 문항별 집계 결과 (2026-10-30). **유효 응답** = 확인 문항 정답을 고른 응답(확인 문항이 없으면 전부). `{ total, excluded, questions: [{ id, type, text, answered, options[{id,text,count}], scale{avg,counts[5]}, texts[] }] }`. 확인 문항은 빼고, 응답자 정보는 넣지 않는다. 응답 1개부터 | 작성자 본인 |
| `close_survey(p_survey_id)` | 응답 마감 (status → closed) + **못 받은 인원 × 1명당 값 환불** (`survey_refund`, 설문당 1번). 이미 마감이면 그대로. 다시 열기 없음 (2026-10-30) | 작성자 본인 |
| `get_hub_list(p_category, p_sort)` | 데이터 허브 목록 (popular·latest·responses). 열람함·응답함·무료·신뢰도·참고용 표시 (2026-10-30) | 로그인한 사람 |
| `get_hub_preview(p_survey_id)` | 무료 정보: 설문 정보·문항 목록·응답자 구성(5명 미만 숨김)·열람 상태·무료 이유·가격 | 볼 수 있는 사람 |
| `get_my_comparison(p_survey_id)` | 내 답 비교 (문항별 내 답과 같은 답 비율, 주관식 제외) | 그 설문 응답자 |
| `view_survey(p_survey_id)` | 전체 열람: 무료 이유가 없으면 `cost_data_view` 차감 → 등록자에게 `data_share_rate` 분배 → `survey_views` 기록. 한 번만. 회원정보 행 잠금 | 볼 수 있는 사람 |
| `get_full_results(p_survey_id)` | 전체 결과: 문항별 집계 + 계열·학년·성별·나이대 나눠 보기(5명 미만 그룹 숨김) + 신뢰 정보. 주관식 원문 없음 | 작성자, 열람한 사람 |
| `get_survey_raw(p_survey_id)` | 원본 CSV: 응답 한 명 = 한 줄 (계열·학년·성별·나이대 + 문항별 답 글자). 이름·이메일·학교·출생연도·응답 시각·사용자 번호 없음, 줄 순서 섞음, 5명 미만 그룹 이름은 "5명 미만" | 작성자만 |
| `get_my_views()` | 내가 열람한 설문 목록 (설문 번호·제목·주최·열람 날짜·낸 포인트), 최신순. 다른 학교 "우리 학교만" 설문도 열람했으면 제목이 보인다 | 본인 |
| `report_survey(p_survey_id, p_reason, p_detail)` | 설문 신고 (사유 spam·abuse·privacy·sexual·other, 설명 200자). 본인 설문·중복 거절. 확인 전 신고가 `report_hide_count`(3)명 이상이면 `moderation = hidden` | 로그인한 사람 |
| `delete_my_account()` | 회원 탈퇴. 진행 중인 내 설문 마감, "나만 보기" 설문 삭제, 계정 삭제 → 회원정보·포인트·신고·단체 정보 삭제, 응답·설문·열람 기록은 사람 연결만 비워 남김 | 본인 |
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
| `not_listed` | 데이터 허브에서 볼 수 없는 결과 (공개 범위·마감·응답 수 조건) |
| `not_respondent` | 내 답 비교는 그 설문에 응답한 사람만 |
| `not_viewed` | 전체 결과는 열람한 뒤에 (view_survey 먼저) |

## 신고 처리 (운영자, 2026-10-30)

1. Table Editor → `reports`에서 `status = pending`인 신고를 본다 (`target_id` = 설문 번호)
2. `surveys`에서 그 설문을 열어 내용을 확인한다 (`moderation`이 `hidden`이면 신고 3건으로 자동 숨김된 상태)
3. 문제없음: 설문 `moderation` → `visible`, 그 설문의 신고 `status` → `kept`
4. 문제있음: 설문 `moderation` → `removed`, 신고 `status` → `removed`
5. 포인트는 건드리지 않는다 (이미 준 응답 보상 유지, 등록비 환불 없음)
