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

### point_rules — 포인트 수치
`key`, `value`, `description`. 값은 `docs/PRD.md` 4-2와 같다. 수치를 바꿀 때는 대시보드에서 이 표만 고친다.

### point_ledger — 포인트 기록
| 칸 | 설명 |
| --- | --- |
| user_id | 누구의 기록인지 |
| amount | 적립은 +, 차감은 − (0 불가) |
| status | `pending` / `confirmed` / `rejected` / `revoked` |
| reason | `welcome` / `survey_reward` / `survey_create` / `data_view` / `balance_vote` |
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
| point_rules | 로그인한 사람 모두 | 불가 (대시보드에서 운영자) |
| point_ledger | 본인 기록만 | 불가 (서버 함수로만) |

로그인 안 한 상태(anon)는 universities 말고는 아무 표도 못 읽는다.

## 서버 함수

| 함수 | 하는 일 | 누가 |
| --- | --- | --- |
| `get_my_balance()` | 본인 잔액 (confirmed 합계) | 로그인한 사람 |
| `complete_signup(p_nickname, p_major_field_id, p_admission_year, p_degree_type, p_terms_agreed)` | 학교 도메인 검사 → 학생 회원정보 저장 → 웰컴 포인트 지급. 이미 가입했으면 아무것도 안 함 | 로그인한 사람 (이메일 인증 완료) |
| `request_org_signup(...)` | 단체 신청·재신청 → 승인 대기. 포인트 없음 | 로그인한 사람 (이메일 인증 완료) |
| `is_email_registered(p_email)` | 그 메일로 **가입을 마친** 계정이 있으면 true (회원정보 없는 반쪽 계정은 false). 예/아니오만 돌려줌 | 누구나 (로그인 전 포함) |

### complete_signup 입력 규칙

- `p_nickname`: 앞뒤 공백 제거 후 2~12자, 다른 회원과 겹치면 안 됨
- `p_major_field_id`: `major_fields`에 있는 id (중계열)
- `p_degree_type`: `undergrad`(학부) / `grad`(대학원)
- `p_admission_year`: 2000 ~ 올해
- `p_terms_agreed`: 반드시 `true` (필수 약관 동의)

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
