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
| account_type | `student` 학생 / `org` 단체 (지금 허용값에 남은 `company`는 단체 가입 작업 때 정리: 기업은 단체 종류 "외부"로) |
| approval_status | 단체 계정 승인용: `pending` 대기 / `approved` 승인 / `rejected` 거절. 학생은 가입 시 바로 `approved` |
| role | `user` / `admin` |
| university_id | 학교 (학생은 필수, 기업은 비움) |
| nickname | 닉네임, 고유 |
| department | 학과 |
| degree_type | 과정: `undergrad` 학부 / `grad` 대학원 |
| admission_year | 입학년도 (예: 2023). 학년은 해마다 바뀌어 저장하지 않는다 |
| terms_agreed_at | 필수 약관(이용약관·개인정보 수집·이용) 동의 시각 |

이메일은 넣지 않는다 (Supabase Auth에만 있음).

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
| point_rules | 로그인한 사람 모두 | 불가 (대시보드에서 운영자) |
| point_ledger | 본인 기록만 | 불가 (서버 함수로만) |

로그인 안 한 상태(anon)는 universities 말고는 아무 표도 못 읽는다.

## 서버 함수

| 함수 | 하는 일 | 누가 |
| --- | --- | --- |
| `get_my_balance()` | 본인 잔액 (confirmed 합계) | 로그인한 사람 |
| `complete_signup(p_nickname, p_department, p_admission_year, p_degree_type, p_terms_agreed)` | 학교 도메인 검사 → 학생 회원정보 저장 → 웰컴 포인트 지급. 이미 가입했으면 아무것도 안 함 | 로그인한 사람 (이메일 인증 완료) |

### complete_signup 입력 규칙

- `p_nickname`: 앞뒤 공백 제거 후 2~12자, 다른 회원과 겹치면 안 됨
- `p_department`: 비울 수 없음
- `p_degree_type`: `undergrad`(학부) / `grad`(대학원)
- `p_admission_year`: 2000 ~ 올해
- `p_terms_agreed`: 반드시 `true` (필수 약관 동의)

### 서버 함수 오류 코드

| 코드 | 뜻 |
| --- | --- |
| `not_authenticated` | 로그인 안 됨 |
| `email_not_verified` | 이메일 인증 안 됨 |
| `domain_not_allowed` | 허용 학교 이메일이 아님 |
| `invalid_nickname` | 닉네임 2~12자 아님 |
| `nickname_taken` | 이미 쓰는 닉네임 |
| `invalid_department` | 학과 비어 있음 |
| `invalid_degree_type` | 과정 값이 잘못됨 |
| `invalid_admission_year` | 입학년도 값이 잘못됨 |
| `terms_not_agreed` | 필수 약관에 동의하지 않음 |
| `rule_missing` | `point_rules`에 필요한 값이 없음 (운영 문제) |
