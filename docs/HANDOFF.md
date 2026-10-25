# Handoff

> 이미 만든 함수·컴포넌트. 새로 만들기 전에 여기서 먼저 찾는다.

## 앱 공용

### `supabase` (`src/lib/supabase.ts`)
Supabase 연결. 화면에서는 `import { supabase } from "@/lib/supabase";`로 가져온다.
로그인 정보는 폰에서는 `expo-sqlite`, 웹에서는 브라우저에 저장된다 (`src/lib/storage*.ts`).

## 서버 함수 (DB 구조는 `docs/DB.md`)

### 잔액 조회 `get_my_balance()`
```ts
const { data: balance, error } = await supabase.rpc("get_my_balance");
// balance: number (confirmed 합계, 없으면 0)
```

### 가입 완료 `complete_signup` (2026-10-26)
이메일 인증번호 확인이 끝난 뒤 호출한다. 회원정보 저장과 웰컴 포인트 지급을 서버가 한 번에 처리한다.
금액은 앱이 보내지 않는다. 두 번 불러도 한 번만 처리된다.

```ts
const { error } = await supabase.rpc("complete_signup", {
  p_nickname: "옛썰러",
  p_department: "경영학과",
  p_grade: 2,              // 대학원이면 null
  p_degree_type: "undergrad", // 또는 "grad"
});
```

오류는 `error.message`에 코드로 온다. 화면 문구 예시:

| `error.message` | 화면 문구 |
| --- | --- |
| `domain_not_allowed` | 가입할 수 있는 학교 이메일이 아니에요. |
| `email_not_verified` | 이메일 인증을 먼저 완료해 주세요. |
| `invalid_nickname` | 닉네임은 2~12자로 입력해 주세요. |
| `nickname_taken` | 이미 사용 중인 닉네임이에요. |
| `invalid_department` | 학과를 입력해 주세요. |
| `invalid_degree_type` | 과정을 선택해 주세요. |
| `invalid_grade` | 학년을 선택해 주세요. |
| 그 외 | 잠시 후 다시 시도해 주세요. |
