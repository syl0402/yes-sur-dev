# DB

> 표를 바꾸면 이 문서도 같이 고친다. SQL 원본은 `supabase/migrations/`.

## 적용 방법

1. `supabase/migrations/`의 새 SQL 파일 내용을 복사
2. Supabase 대시보드 → SQL Editor에 붙여넣고 Run
3. 이미 적용한 파일은 다시 실행하지 않는다. 바꿀 게 있으면 **새 파일**을 만든다

| 파일 | 내용 | 적용일 |
| --- | --- | --- |
| `20261026000001_base_tables.sql` | 학교·회원정보·포인트 규칙·포인트 기록, 잔액 함수 | 2026-10-26 |

## 표

### universities — 가입 허용 학교
| 칸 | 설명 |
| --- | --- |
| id | 자동 번호 |
| name | 학교 이름 |
| email_domain | 이메일 도메인 (예: `cau.ac.kr`), 고유 |

처음 데이터: 중앙대학교 `cau.ac.kr`. 학교 추가는 이 표에 한 줄 넣으면 된다.

### profiles — 회원정보
| 칸 | 설명 |
| --- | --- |
| id | 로그인 계정 id (계정 삭제 시 함께 삭제) |
| account_type | `student` 학생 / `org` 학생회·교내 기관 / `company` 외부 기업 |
| approval_status | `pending` 대기 / `approved` 승인 / `rejected` 거절 |
| role | `user` / `admin` |
| university_id | 학교 (학생은 필수, 기업은 비움) |
| nickname | 닉네임, 고유 |
| department, grade, degree_type | 학과, 학년, 과정 |

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
| universities | 로그인한 사람 모두 | 불가 |
| profiles | 본인 행만 | 불가 (서버 함수로만) |
| point_rules | 로그인한 사람 모두 | 불가 (대시보드에서 운영자) |
| point_ledger | 본인 기록만 | 불가 (서버 함수로만) |

로그인 안 한 상태(anon)는 아무 표도 못 읽는다.

## 서버 함수

| 함수 | 하는 일 | 누가 |
| --- | --- | --- |
| `get_my_balance()` | 본인 잔액 (confirmed 합계) | 로그인한 사람 |
