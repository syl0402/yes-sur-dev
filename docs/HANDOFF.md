# Handoff

> 이미 만든 함수·컴포넌트. 새로 만들기 전에 여기서 먼저 찾는다.

## 앱 공용

### `supabase` (`src/lib/supabase.ts`)
Supabase 연결. 화면에서는 `import { supabase } from "@/lib/supabase";`로 가져온다.
로그인 정보는 폰에서는 `expo-sqlite`, 웹에서는 브라우저에 저장된다 (`src/lib/storage*.ts`).

### 화면 구조 (2026-10-29)
- 로그인 전: `src/app/index.tsx` (로그인되면 `/home`으로 이동)
- 로그인 후: 하단 탭 `src/app/(tabs)/` — `home` · `surveys` · `balance` · `data` · `my`
- 탭 사이 이동은 `router.navigate("/surveys")`
- 내 정보 (2026-10-30): 마이 탭 이름을 누르면 `/account` — 회원정보 보기(고치려면 문의), 성별·출생연도 한 번 입력(`/account/demographics`, 비어 있을 때만), 비밀번호 변경(`/account/password`, 현재 비밀번호 확인 후), 로그아웃. 회원 탈퇴는 다음 단계에서 이 페이지에 추가

### `AppIcon` · `tabIcons` (`src/components/AppIcon.tsx`, `src/constants/icons.ts`, 2026-10-29)
아이콘은 `@expo/vector-icons`의 Ionicons. 아이콘 이름은 `icons.ts` 한 곳에 모은다(디자인팀 교체 지점). 목록: https://icons.expo.fyi
```tsx
<AppIcon name={tabIcons.home} color={colors.primary} size={24} />
```

### `ComingSoon` (`src/components/ComingSoon.tsx`, 2026-10-29)
아직 만들지 않은 화면의 "준비 중" 안내.
```tsx
<ComingSoon title="데이터 허브" message="설문 결과 열람은 곧 열려요." />
```

### 설문 목록 도우미 (`src/lib/surveys.ts`, 2026-10-29)
- `fetchOpenSurveys()`: 내가 지금 참여할 수 있는 설문 (진행 중 · 마감 전 · 자리 있음 · 응답 안 함 · 내 설문 아님). 응답 대상이 아닌 설문은 RLS에서 이미 빠짐
- `sortSurveys(list, "recommended" | "latest" | "closing" | "reward")`: 추천순 = 우리 학교 → 마감 임박 → 남은 자리 적은 순
- `matchesDuration(survey, "lt5" | "5to15" | "gte15" | "all")`, `remainingSpots(survey)`
- 설문 상세로 가기: `router.push({ pathname: "/survey/[id]", params: { id: String(id) } })`

### 내 설문 결과 · 응답 마감 (2026-10-30)
- 화면: `router.push({ pathname: "/survey/results", params: { id } })` (상세에서 작성자에게만 [결과 보기])
- 결과: `supabase.rpc("get_survey_results", { p_survey_id })` → 작성자 본인만. 모양은 `docs/DB.md`
- 마감: `supabase.rpc("close_survey", { p_survey_id })` → 작성자 본인만 (못 받은 인원만큼 환불)
- 결과 공개 범위: 등록 때 `create_survey`에 `p_result_visibility: "public" | "campus" | "private"`, 나중엔 `supabase.rpc("set_result_visibility", { p_survey_id, p_visibility })`. 화면 문구는 `VISIBILITY_LABELS` (`surveyDraft.ts`)
- 데이터 허브(공개 결과)에서도 같은 결과 화면 모양을 다시 쓸 예정

### 데이터 허브 (2026-10-30)
- 목록 `(tabs)/data.tsx` → 결과 `/data/[id]` (무료 정보 → 응답자 내 답 비교 → 열람 → 전체 결과)
- 서버 함수: `get_hub_list`, `get_hub_preview`, `get_my_comparison`, `view_survey`, `get_full_results` (모양은 `src/lib/hub.ts` 타입, 설명은 `docs/DB.md`)
- 결과 그래프는 공용 `QuestionResult` (`src/components/results/QuestionResult.tsx`) — 내 결과 화면과 같이 씀
- 나눠 보기 그룹 순서는 `sortGroups` (`src/lib/hub.ts`)
- 전체 결과 묶음은 `ResultsView` (`src/components/results/ResultsView.tsx`): 응답 정보 · 핵심 요약 · 출처 복사(expo-clipboard) · 나눠 보기 칩 · 문항별 결과. 데이터 결과 화면과 내 결과 화면이 같이 씀
- 요약 문장 규칙은 `src/lib/resultSummary.ts` (`questionLine`, `biggestGap`, `formatSeconds`)
- CSV는 `src/lib/csv.ts`: `aggregateCsv`(집계, 열람자·등록자), `rawCsv`(원본, 등록자), `csvFileName`, `shareCsv`(폰 = 공유 창, 웹 = 바로 다운로드). 엑셀 한글 깨짐 방지(BOM), 수식으로 실행될 글자 막기
- 마이 탭 "열람한 결과"는 `get_my_views` → 누르면 `/data/[id]` (이미 열람해서 전체 결과가 바로 보임)
- 신고: 화면 `src/app/report.tsx`(ys-160, `?survey=id`), 링크 `ReportLink` (`src/components/ReportLink.tsx`)를 설문 상세·데이터 결과 맨 아래에 (본인 설문 제외). 서버 `report_survey`. 숨긴 설문은 마이 탭 "내가 올린 설문"에 "검토 중"
- 회원 탈퇴: 내 정보 맨 아래 → `src/app/account/delete.tsx`(ys-154). 현재 비밀번호 확인 → `delete_my_account` → `signOut({ scope: "local" })` → 첫 화면. 응답은 `grp_*` 칸에 응답 시점 그룹이 저장되어 탈퇴 후에도 나눠 보기 유지
- 약관: 원본 글은 `docs/legal/` (노션에 붙여 게시). 앱은 가입 약관 4개 동의(만 14세·이용약관·개인정보·결과 통계 공개) + 요약, 전문은 `openLegal` (`src/lib/legal.ts`, 노션 주소). 내 정보에 이용약관·개인정보처리방침 메뉴
- 공식 설문: 운영자 = `profiles.role = admin` (`dev_tools.sql` 11번으로 지정). 주최 "옛썰 공식 ✓", 결과 무료 열람. 시작용 10개는 `supabase/seed/official_surveys.sql` (11/13 실행)
- 의견 보내기: `src/app/feedback.tsx`(ys-170, `?from=화면 이름`). 마이 탭 이름 아래 한 줄 + 내 정보 메뉴. 기기 정보는 `Platform` · `expo-device` · `expo-constants`. 답변은 운영자가 Table Editor에서
- 오늘의 질문: 홈 맨 위 `DailyCard` (`src/components/DailyCard.tsx`) → `get_today_daily` / `answer_daily`. 질문 예약은 `supabase/seed/daily_questions.sql` 또는 Table Editor → `daily_questions` (날짜 하나에 질문 하나)
- 커뮤니티 (2026-10-30 밸런스 탭 → 커뮤니티 탭): 피드 `src/app/(tabs)/community.tsx`, 글 `community/[id].tsx`, 만들기 `community/new.tsx`, 카드 `PostCard` (`src/components/community/`). 타입·라벨 `src/lib/community.ts`. `sortGroups`는 그룹 모양과 상관없이 씀 (`src/lib/hub.ts`)
- 커뮤니티 댓글: `Comments` (`src/components/community/Comments.tsx`, `type` = post·daily). 글 ⋯ 메뉴는 `showActions` (`src/lib/confirm.ts`). 본문 수정 `community/edit.tsx`. 신고 화면은 `?type=post|comment&id=` 또는 예전 `?survey=`
- 오늘의 질문 상세: 홈 `DailyCard`를 누르면 `community/daily.tsx` (같은 카드 + 그룹별 + 댓글 `type=daily`, 오늘 것만. 2026-10-30 지난 질문 목록은 없앰). 닉네임 바꾸기 `account/nickname.tsx` (내 정보 → 학생만)
- 설문 홍보·계열 대항전: 홍보글은 `PostCard` 안 `PromoBox`(설문 요약 + 응답하러 가기), 만들기 화면 종류 "설문 홍보"(`create_promo`). 대항전은 피드 맨 위 `MajorRankingCard`
- 사용자가 쓴 글의 링크: `LinkedText` (`src/components/LinkedText.tsx`) — http(s) 주소는 파란 링크, 누르면 "옛썰 밖의 링크" 확인 후 열기. 상세 화면 본문·댓글은 길게 눌러 복사(`selectable`)
- 친구 초대: `src/app/invite.tsx` (마이 탭 "🎁 친구 초대", 학생만). 코드 복사 `expo-clipboard`, 공유 `Share`(RN 기본)
- 첫 사용 안내: `src/app/onboarding.tsx` (학생만 3장, 가입 완료 → 안내 → 홈. 기존 회원은 홈에서 이 폰 첫 실행 때 한 번, `src/lib/onboarding.ts`로 기억). 내 정보 "사용 안내 다시 보기"(`?again=1`)
- 포인트 안내: `src/app/points.tsx` (모으기·쓰기·규칙, 숫자는 모두 `fetchRules`로 point_rules). 마이 탭 포인트 상자·내 정보·첫 사용 안내에서 링크
- 테스트할 때 응답자가 적으면 `dev_tools.sql` 10번(최소 응답 수 1)으로. 출시 전 5로 되돌리기

### `formatHost` (`src/lib/surveys.ts`, 2026-10-30)
설문 작성자 표시: 인증된 단체는 `"경영학과 학생회 ✓"`, 학생 설문은 `"개인"`. 설문을 읽을 때 `host_name, host_verified`를 같이 select 한다.
```ts
formatHost(survey); // "경영학과 학생회 ✓" 또는 "개인"
```

### `formatTimeLeft` (`src/lib/format.ts`, 2026-10-29)
마감까지 남은 시간: `"3일 남음"` / `"5시간 남음"` / `"곧 마감"` / `"마감"`

### `formatDate` (`src/lib/format.ts`, 2026-10-29)
날짜를 `"2026.10.29"` 형식으로. 포인트 내역 등에서 사용.

### 포인트 내역 (마이 탭 `src/app/(tabs)/my.tsx`, 2026-10-29)
`point_ledger`(본인 것만 읽힘)의 confirmed 기록을 최신순으로. 설문 응답 기록은 `ref_id`(설문 번호)로 설문 이름을 붙인다.

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

### `showConfirm` (`src/lib/confirm.ts`, 2026-10-29)
버튼 두 개짜리 확인 창 (폰은 Alert, 웹은 브라우저 확인 창). 진행 버튼을 누를 때만 `onOk` 실행.
```ts
showConfirm({ title: "제출할까요?", message: "제출하면 답을 바꿀 수 없어요.", okLabel: "제출", cancelLabel: "다시 보기", onOk: submit });
```

### 설문 응답 흐름 (2026-10-29)
상세 `/survey/[id]` → 응답 `/survey/respond?id=` → 완료 `/survey/done?reward=` (응답 화면은 완료 화면으로 교체).
응답 화면에서 나가려 하면 `usePreventRemove`(expo-router)로 확인 창을 띄운다.

### `fetchRules` (`src/lib/rules.ts`, 2026-10-30)
`point_rules` 값을 key → 숫자로. 화면에 한도·기본값·예상 금액을 보여줄 때만 (실제 금액은 서버가 정함).
```ts
const rules = await fetchRules(["survey_max_questions", "cost_survey_create"]);
rules.survey_max_questions; // 30
```

### 설문 작성 (2026-10-30)
- 화면: `/create` 하나 안에서 단계(기본 정보 → 문항 → 대상·마감 → 확인)가 바뀐다. 단계 화면은 `src/components/create/`
- 작성 중인 설문 모양·검사·예상 계산: `src/lib/surveyDraft.ts` (`basicsValid`, `questionsValid`, `settingsValid`, `estimate`, `toRpcQuestions`)
- 들어가기: `router.push("/create")` (홈·설문 탭의 [설문 등록])
- 등록 후 내 설문 상세로 교체. 내 설문 목록은 마이 탭 "내가 올린 설문"
- 임시저장함 (2026-10-30): `listDrafts` / `getDraft` / `saveDraft` / `deleteDraft` / `isBlankDraft` (`surveyDraft.ts`). 이 폰의 `localStorage`에 계정마다 여러 개(`survey_drafts:<userId>`). 작성 화면은 자동 저장하지 않고 오른쪽 위 [임시저장]이나 나갈 때 창(`showChoice`: 임시저장하고 나가기·저장하지 않고 나가기·계속 작성, 바뀐 게 있을 때만)으로 저장 (2026-10-30 변경), 마이 탭 "임시저장한 설문"에서 이어 쓰기(`router.push({ pathname: "/create", params: { draft: id } })`)·삭제. 임시저장 번호 = 등록 요청 번호라 같은 임시저장을 두 번 등록해도 설문 1개. 등록하면 지운다
- `showConfirm`의 `onCancel`: 취소 버튼을 눌렀을 때 할 일 (예: [새로 쓰기] → 저장본 지우기)

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
  p_gender: "female",         // "male" | "female" | "undisclosed" (2026-10-30)
  p_birth_year: 2004,         // 출생연도 (2026-10-30)
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
const { data, error } = await supabase.rpc("submit_response", {
  p_survey_id: surveyId,
  p_answers: [
    { question_id: 1, option_ids: [3] },
    { question_id: 2, option_ids: [7] },
  ],
  p_duration_seconds: 95, // 응답에 걸린 초 (참고용)
});
// data: { reward: 30, passed: true } — 확인 문항을 틀리면 { reward: 0, passed: false } (다시 응답 가능, 2026-10-30)
```
오류 코드는 `docs/DB.md` (`already_responded`, `survey_closed`, `not_target` 등)
4종 문항 답 형식(2026-10-30): 복수 `option_ids: [7, 8]`, 척도 `scale_value: 4`, 주관식 `text_value: "…"` (자세히는 `docs/DB.md`)

### 설문 등록 `create_survey` (2026-10-30)
등록 검사·소요시간·보상 계산·주의 문항 추가·비용 차감을 서버가 한 번에. 금액은 보내지 않는다.
`p_request_id`는 작성 화면을 열 때 한 번 만든 uuid (연타·재시도해도 설문 1개, 비용 1번).
```ts
const { data: surveyId, error } = await supabase.rpc("create_survey", {
  p_request_id: requestId,
  p_category_id: 1,
  p_title: "대학생 스터디 습관 조사",
  p_description: "",
  p_audience: "all",          // 또는 "campus"
  p_target: 50,
  p_days: 7,
  p_questions: [
    { type: "single", text: "자주 공부하는 곳은?", options: ["도서관", "카페"] },
    { type: "scale", text: "만족도는?" },
  ],
});
```
한도·기본값은 `point_rules`에서 읽는다 (`survey_max_questions`, `survey_default_target` 등).

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
