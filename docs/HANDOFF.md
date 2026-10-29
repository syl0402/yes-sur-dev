# Handoff

> 이미 만든 함수·컴포넌트. 새로 만들기 전에 여기서 먼저 찾는다.

## 앱 공용

### `supabase` (`src/lib/supabase.ts`)
Supabase 연결. 화면에서는 `import { supabase } from "@/lib/supabase";`로 가져온다.
로그인 정보는 폰에서는 `expo-sqlite`, 웹에서는 브라우저에 저장된다 (`src/lib/storage*.ts`).

### `PrimaryButton` (`src/components/PrimaryButton.tsx`)
큰 파란 버튼. `disabled`면 회색, `loading`이면 돌아가는 표시 + 누르기 막힘(연타 방지).
```tsx
<PrimaryButton title="다음" onPress={goNext} disabled={!ok} loading={sending} />
```

### `StepIndicator` (`src/components/StepIndicator.tsx`, 2026-10-27)
여러 화면으로 나뉜 흐름에서 지금 단계를 막대 + "2 / 5"로 보여준다. 가입은 5단계(유형·약관·이메일·인증번호·회원정보/단체정보).
```tsx
<StepIndicator current={2} total={5} />
```

### `errorMessage` (`src/lib/errors.ts`)
Supabase 오류를 한국어 문구로. 새 오류 코드가 생기면 이 파일에 한 줄 추가.
```ts
if (error) setError(errorMessage(error));
```

### `formatPoints` (`src/lib/format.ts`, 2026-10-27)
포인트를 `1,000P` 형식으로.
```ts
formatPoints(500); // "500P"
```

### `useSession` (`src/hooks/useSession.ts`, 2026-10-27)
지금 로그인 상태. `undefined` = 확인 중, `null` = 로그아웃, 그 외 = 로그인(`session.user.id`).
```ts
const session = useSession();
if (session?.user) { /* 로그인됨 */ }
```

### `showNotice` (`src/lib/notice.ts`, 2026-10-27)
확인 버튼 하나짜리 안내 창 (폰은 Alert, 웹은 브라우저 알림). 닫힌 뒤 할 일은 세 번째 인자로.
```ts
showNotice("이미 가입된 계정이에요", "이 메일로 로그인했어요.", () => router.replace("/"));
```

### `useResumeSignup` (`src/hooks/useResumeSignup.ts`, 2026-10-27)
`_layout.tsx`에서 한 번 부른다. 로그인됨 + 회원정보 없음이면 `/signup/type?resume=1`(가입 유형 선택)로 보내 가입을 이어서 끝내게 한다.
가입 화면(`/signup/...`) 안에서는 동작하지 않는다.
승인 전(대기·거절) 단체 계정은 `/signup/pending`(승인 대기 화면)으로 보낸다.

### `confirmLeaveSignup` (`src/lib/leaveSignup.ts`, 2026-10-27)
가입 중간(인증 이후) 화면의 "나가기". 확인 창 → 로그아웃 → 첫 화면. 회원정보·단체 정보 화면에서 사용.

## 서버 함수 (DB 구조는 `docs/DB.md`)

### 잔액 조회 `get_my_balance()`
```ts
const { data: balance, error } = await supabase.rpc("get_my_balance");
// balance: number (confirmed 합계, 없으면 0)
```

### 가입 완료 `complete_signup` (2026-10-26, 매개변수 변경 2026-10-27)
이메일 인증번호 확인이 끝난 뒤 호출한다. 회원정보 저장과 웰컴 포인트 지급을 서버가 한 번에 처리한다.
금액은 앱이 보내지 않는다. 두 번 불러도 한 번만 처리된다.

```ts
const { error } = await supabase.rpc("complete_signup", {
  p_nickname: "옛썰러",
  p_major_field_id: 3,        // major_fields의 id (예: 경영·경제)
  p_admission_year: 2023,
  p_degree_type: "undergrad", // 또는 "grad"
  p_terms_agreed: true,       // 필수 약관 동의
});
```

### 단체 신청 `request_org_signup` (2026-10-27)
이메일 인증 후 호출. 승인 대기 상태가 된다. 거절된 단체가 다시 부르면 재신청.
```ts
const { error } = await supabase.rpc("request_org_signup", {
  p_kind: "campus",                  // 또는 "external"
  p_name: "중앙대 총학생회",
  p_university_id: 1,                // 외부면 null
  p_evidence_url: "https://instagram.com/...",
  p_description: "한 줄 소개",       // 비워도 됨
  p_terms_agreed: true,
});
```
승인 상태 확인: `supabase.from("profiles").select("account_type, approval_status").eq("id", userId).maybeSingle()`
단체 정보·거절 사유: `supabase.from("organizations").select("*").eq("id", userId).maybeSingle()`

### 가입 여부 확인 `is_email_registered` (2026-10-27, 로그인 전에도 가능)
```ts
const { data: registered } = await supabase.rpc("is_email_registered", { p_email: email });
// true = 가입을 마친 메일
```

### 응답 제출 `submit_response` (2026-10-29)
모든 문항의 답을 한 번에 보낸다. 금액은 보내지 않는다(서버가 설문에 저장된 값으로 지급). 같은 설문은 한 번만.
```ts
const { data: reward, error } = await supabase.rpc("submit_response", {
  p_survey_id: surveyId,
  p_answers: [
    { question_id: 1, option_id: 3 },
    { question_id: 2, option_id: 7 },
  ],
});
// reward: 받은 포인트 (예: 300) → formatPoints(reward)
```
오류 코드는 `docs/DB.md` (`already_responded`, `survey_closed`, `not_target` 등)

### 설문 목록 / 문항 읽기 (2026-10-29)
응답 대상이 아닌 설문은 RLS로 자동으로 빠진다.
```ts
const { data } = await supabase
  .from("surveys")
  .select("id, title, est_minutes, reward_points, closes_at, status, survey_categories(name)")
  .eq("status", "open")
  .order("created_at", { ascending: false });

const { data: questions } = await supabase
  .from("questions")
  .select("id, sort_order, text, question_options(id, sort_order, text)")
  .eq("survey_id", surveyId)
  .order("sort_order");
```

### 학교 목록 (로그인 전에도 가능)
```ts
const { data } = await supabase.from("universities").select("id, name, email_domain").order("name");
```

### 전공 계열 목록 (로그인 후, 2026-10-27)
```ts
const { data } = await supabase
  .from("major_fields")
  .select("id, category, category_name, name")
  .order("sort_order");
```

오류는 `error.message`에 코드로 온다. 화면 문구 예시:

| `error.message` | 화면 문구 |
| --- | --- |
| `domain_not_allowed` | 가입할 수 있는 학교 이메일이 아니에요. |
| `email_not_verified` | 이메일 인증을 먼저 완료해 주세요. |
| `invalid_nickname` | 닉네임은 2~12자로 입력해 주세요. |
| `nickname_taken` | 이미 사용 중인 닉네임이에요. |
| `invalid_major_field` | 전공 계열을 선택해 주세요. |
| `invalid_degree_type` | 과정을 선택해 주세요. |
| `invalid_admission_year` | 입학년도를 선택해 주세요. |
| `terms_not_agreed` | 필수 약관에 동의해 주세요. |
| 그 외 | 잠시 후 다시 시도해 주세요. |
