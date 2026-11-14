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
- 삭제 (2026-11-10): `supabase.rpc("delete_survey", { p_survey_id })` → 작성자 본인 + 정상 응답 0명만. 돌려준 포인트 숫자를 돌려줌. 다시 고치기는 `fetchSurveyAsDraft(id)`(`surveyDraft.ts`, 문항은 `get_survey_for_copy`) → `saveDraft` → `delete_survey` → `/create?draft=`
- 결과 공개 범위: 등록 때 `create_survey`에 `p_result_visibility: "public" | "campus" | "private"`, 나중엔 `supabase.rpc("set_result_visibility", { p_survey_id, p_visibility })`. 화면 문구는 `VISIBILITY_LABELS` (`surveyDraft.ts`)
- 데이터 허브(공개 결과)에서도 같은 결과 화면 모양을 다시 쓸 예정

### 데이터 허브 (2026-10-30)
- 목록 `(tabs)/data.tsx` → 결과 `/data/[id]` (무료 정보 → 응답자 내 답 비교 → 열람 → 전체 결과)
- 서버 함수: `get_hub_list`, `get_hub_preview`, `get_my_comparison`, `view_survey`, `get_full_results` (모양은 `src/lib/hub.ts` 타입, 설명은 `docs/DB.md`)
- 결과 그래프는 공용 `QuestionResult` (`src/components/results/QuestionResult.tsx`) — 내 결과 화면과 같이 씀
- 나눠 보기 그룹 순서는 `sortGroups` (`src/lib/hub.ts`)
- 전체 결과 묶음은 `ResultsView` (`src/components/results/ResultsView.tsx`, 2026-11-01 정리): 핵심 인사이트(`InsightCard`) → 탭 [문항별 결과(기준 칩 전체·계열·학년·성별·나이대·문항 답별(교차 분석 `get_cross_results`) + `QuestionResult`, 묶음 보기는 접힘=묶음별 1위 한 줄/펼침=전체 막대) | 응답자(`CompositionChart`) | 조사 정보(숫자 카드 · 출처 복사 · 집계 CSV)]. 데이터 결과 화면과 내 결과 화면이 같이 씀. 열람 전 미리보기는 `InsightCard`(제목 "미리 보는 인사이트", `get_hub_teaser`) + `CompositionChart compact`
- 데이터 탭(`(tabs)/data.tsx`, 2026-11-01): 제목 검색 · 카테고리/정렬 칩 · ✓ 인증 단체 · ★ 저장 칩(`get_my_bookmarks`). 결과 상세 오른쪽 위 ☆/★ (`toggle_bookmark`)
- 결과 카드 공유 (2026-11-01 → 2026-11-14 데이터 허브 시안): 결과 화면 아래 고정 바 `ResultsActionBar` [출처] [공유] [집계 CSV 받기] → [공유] = `results/ShareSheet` (공용 BottomSheet: 인사이트 카드 / 문항 카드 · 미리보기 · 문항 칩 · [출처 복사] [이미지로 공유]). 카드 = `results/ResultCards` `StoryCard`(9:16, 1080×1920 저장) · `SquareCard`(1:1, 1080×1080), 내용은 `lib/shareCards` `buildStoryData`(묶음 차이가 가장 큰 문항·답, 없으면 1위 답이 가장 뚜렷한 문항) · `buildSquareData`(상위 4개 · 척도는 3묶음). 응답이 적은 묶음(`low_response_warning`)은 카드에서 뺌. 출처 문구는 `lib/citation`. 화면 밖에 그린 큰 카드를 `captureRef` → `expo-sharing`. 웹은 [공유] 숨김
- 인사이트 규칙은 `src/lib/resultSummary.ts` (`buildInsights`: 압도적 답 ≥60% · 팽팽 ≤10%p · 그룹 차이 `biggestGap` · 척도 최고/최저, 최대 4개). 막대는 `Bar`(`top`이면 1위 강조)
- CSV는 `src/lib/csv.ts`: `aggregateCsv`(집계, 열람자·등록자), `rawCsv`(원본, 등록자), `csvFileName`, `shareCsv`(폰 = 공유 창, 웹 = 바로 다운로드). 엑셀 한글 깨짐 방지(BOM), 수식으로 실행될 글자 막기
- 마이 탭 "열람한 결과"는 `get_my_views` → 누르면 `/data/[id]` (이미 열람해서 전체 결과가 바로 보임)
- 신고: 화면 `src/app/report.tsx`(ys-160, `?survey=id`), 링크 `ReportLink` (`src/components/ReportLink.tsx`)를 설문 상세·데이터 결과 맨 아래에 (본인 설문 제외). 서버 `report_survey`. 숨긴 설문은 마이 탭 "내가 올린 설문"에 "검토 중"
- 회원 탈퇴: 내 정보 맨 아래 → `src/app/account/delete.tsx`(ys-154). 현재 비밀번호 확인 → `delete_my_account` → `signOut({ scope: "local" })` → 첫 화면. 응답은 `grp_*` 칸에 응답 시점 그룹이 저장되어 탈퇴 후에도 나눠 보기 유지
- 약관: 원본 글은 `docs/legal/` (노션에 붙여 게시). 앱은 가입 약관 4개 동의(만 14세·이용약관·개인정보·결과 통계 공개) + 요약, 전문은 `openLegal` (`src/lib/legal.ts`, 노션 주소). 내 정보에 이용약관·개인정보처리방침 메뉴
- 공식 설문: 운영자 = `profiles.role = admin` (`dev_tools.sql` 11번으로 지정). 주최 "옛썰 공식 ✓", 결과 무료 열람. 시작용 10개는 `supabase/seed/official_surveys.sql` (11/13 실행)
- 의견 보내기: `src/app/feedback.tsx`(ys-170, `?from=화면 이름`). 마이 탭 이름 아래 한 줄 + 내 정보 메뉴. 기기 정보는 `Platform` · `expo-device` · `expo-constants`. 답변은 운영자가 Table Editor에서
- 오늘의 질문: 홈 맨 위 `DailyCard` (`src/components/DailyCard.tsx`) → `get_today_daily` / `answer_daily`. 질문 예약은 `supabase/seed/daily_questions.sql` 또는 Table Editor → `daily_questions` (날짜 하나에 질문 하나)
- 커뮤니티 (2026-10-30 밸런스 탭 → 커뮤니티 탭): 피드 `src/app/(tabs)/community.tsx`, 글 `community/[id].tsx`, 만들기 `community/new.tsx`, 카드 `PostCard` (`src/components/community/`). 타입·라벨 `src/lib/community.ts`. `sortGroups`는 그룹 모양과 상관없이 씀 (`src/lib/hub.ts`)
- 커뮤니티 댓글: `Comments` (`src/components/community/Comments.tsx`, `type` = post·daily·worldcup). 2026-11-03: 익명 체크 `AnonToggle`(학생만, `fetchCanAnonymous`), 답글 한 단계(2026-11-14부터 "답글 달기" → 아래 고정 입력칸이 답글 모드), 👍 공감, BEST 뱃지, 시간 `formatDateTime`(11/01 20:37). 글 만들기에도 `AnonToggle`. 글 ⋯ 메뉴는 `showActions` (`src/lib/confirm.ts`). 본문 수정 `community/edit.tsx`. 신고 화면은 `?type=post|comment&id=` 또는 예전 `?survey=`
- 오늘의 질문 상세: 홈 `DailyCard`를 누르면 `community/daily.tsx` (같은 카드 + 그룹별 + 댓글 `type=daily`, 오늘 것만. 2026-10-30 지난 질문 목록은 없앰). 닉네임 바꾸기 `account/nickname.tsx` (내 정보 → 학생만)
- 설문 홍보·계열 대항전: 홍보글은 `PostCard` 안 `PromoBox`(설문 요약 + 응답하러 가기), 만들기 화면 종류 "설문 홍보"(`create_promo`). 대항전은 피드 위 `SchoolRankingCard` (2026-11-02 학교 대항전으로 교체, `get_school_ranking`)
- 월드컵 (2026-11-01): `WorldcupCard` ('월드컵' 탭 목록 한 줄, `hot`이면 🔥 HOT 뱃지), 화면 `community/worldcup/[id].tsx`, 대진 계산은 `src/lib/worldcup.ts`(`startBracket`·`pick`). 첫 판만 서버 저장
- 커뮤니티 위쪽 (2026-11-03): `DailyCard compact`(답하면 얇은 막대 2줄) + `TrendingTicker items`("🔥 HOT" 롤링 한 줄: HOT 1~5위 글·월드컵, 3초마다, 동작 줄이기면 멈춤, ▾로 HOT TOP + 학교 대항전 펼침). HOT 목록은 `community.tsx`가 `fetchHot()`(lib/community)으로 들어올 때 + 30초마다 불러와 롤링·뱃지에 나눠 줌. 누르면 갈 곳은 `hotHref()`
- 🔥 HOT 뱃지: `PostCard hot`, `WorldcupCard hot` (Badge tone `hot`, 색은 theme `hot`·`hotSoft`)
- 당겨서 새로고침 (2026-11-03): 커뮤니티·설문·데이터 탭 ScrollView에 `RefreshControl` (React Native 기본)
- HOT TOP 목록: `WeeklyBestCard items` (HOT 롤링 ▾ 안, 비면 안 그림)
- 사용자가 쓴 글의 링크: `LinkedText` (`src/components/LinkedText.tsx`) — http(s) 주소는 파란 링크, 누르면 "옛썰 밖의 링크" 확인 후 열기. 상세 화면 본문·댓글은 길게 눌러 복사(`selectable`)
- 친구 초대: `src/app/invite.tsx` (마이 탭 "🎁 친구 초대", 학생만). 코드 복사 `expo-clipboard`, 공유 `Share`(RN 기본)
- 첫 사용 안내: `src/app/onboarding.tsx` (학생만 3장, 가입 완료 → 안내 → 홈. 기존 회원은 홈에서 이 폰 첫 실행 때 한 번, `src/lib/onboarding.ts`로 기억). 내 정보 "사용 안내 다시 보기"(`?again=1`)
- 학교: 가입 화면 `signup/email.tsx`는 `universities` + `university_domains`(주소 여러 개면 칩으로 고르기, 6개 이상이면 검색칸). 학교 추가·수정은 `supabase/seed/universities.sql`
- 포인트 안내: `src/app/points.tsx` (모으기·쓰기·규칙, 숫자는 모두 `fetchRules`로 point_rules). 마이 탭 포인트 상자·내 정보·첫 사용 안내에서 링크
- 테스트할 때 응답자가 적으면 `dev_tools.sql` 10번(최소 응답 수 1)으로. 출시 전 5로 되돌리기

### 커뮤니티 시안 부품 (2026-11-14)
- `useCommentThread(type, id, onChanged?)` (`src/hooks/useCommentThread.ts`): 댓글 목록·보내기·익명·답글 대상·공감·⋯ 메뉴 상태. `Comments`(목록)와 `CommentComposer`(화면 맨 아래 고정 입력칸)에 같은 `thread`를 넘긴다. 화면은 `<View flex1><ScrollView>…<Comments thread/></ScrollView><CommentComposer thread/></View>`
- `Comments` `sides`: 투표 글 보기 이름 → 댓글마다 고른 편 배지("○○파", 첫 편 파랑·둘째 편 라임). 서버 `get_comments`의 `side`(내가 투표했거나 내 글일 때만)
- `TugBar` (`src/components/community/TugBar.tsx`): 밸런스 줄다리기 막대. md 피드 56px · lg 상세 72px. 투표 전 연한 색 반반 + 바로 투표
- `CardFooter` (`src/components/community/CardFooter.tsx`): 커뮤니티 카드 아랫줄 (구분선 + 사람·말풍선 아이콘, 숫자 굵게, 오른쪽 설명)
- `GroupCompare` · `DimChips` · `FocusChips` (`src/components/results/GroupCompare.tsx`): 묶음별 비교 막대 (데이터 허브 나눠 보기 · 커뮤니티 그룹별로 보기 공용)
- `LabelRow` (`src/components/create/LabelRow.tsx`): 칸 이름 + 80% 넘으면 글자 수
- 월드컵 `src/components/worldcup/`: `MatchView`(대결·되돌리기) · `RoundBreak`(라운드 중간) · `WinView`(우승) · `ResultView`(시상대·순위·그룹별 1위)
- `GrowBar` `delay`: 여러 막대를 차례로 채울 때

### 마이 탭 시안 부품 (2026-11-14)
- `fetchMySurveys` · `MySurvey` (`src/lib/mySurveys.ts`): 내가 올린 설문 + 데이터 탭 열람 수. `MySurveyCard` (`src/components/my/MySurveyCard.tsx`): 응답 0명이면 "홍보하기 ›"
- `fetchMyDataRows` · `fetchMyCommunity` (`src/lib/myActivity.ts`): 내 데이터(응답·스크랩·열람) / 내 글·댓글·참여(`get_my_participation`)
- 화면: `my-surveys`(내 설문 전체) · `my-data`(내 데이터) · `my-posts`(내 커뮤니티 활동 [글|댓글|참여])
- `fetchLedger`의 `detail` (웰컴 미션 이름 · 보너스 · "목표 n명 × nP"), `fetchMonthSummary` (이번 달 모은·쓴)
- 의견 캡처(최대 3장): `pickFeedbackImages` · `uploadFeedbackImage` · `feedbackImageUrl` (`src/lib/feedbackImage.ts`, 저장소 feedback 비공개)
- `Segmented`: 흰 알약이 미끄러짐 (모든 화면 공통)

### `formatHost` (`src/lib/surveys.ts`, 2026-10-30)
설문 작성자 표시: 인증된 단체는 `"경영학과 학생회 ✓"`, 학생 설문은 `"개인"`. 설문을 읽을 때 `host_name, host_verified`를 같이 select 한다.
```ts
formatHost(survey); // "경영학과 학생회 ✓" 또는 "개인"
```

### `formatTimeLeft` (`src/lib/format.ts`, 2026-10-29)
마감까지 남은 시간: `"3일 남음"` / `"5시간 남음"` / `"곧 마감"` / `"마감"`

### `formatDday` (`src/lib/format.ts`, 2026-11-12)
마감 D-day: `"D-4"` / 하루 안 남았으면 `"오늘"` / `"마감"` / 마감일 없으면 `"-"`. 설문 상세 요약 칸.

### `formatAgo` (`src/lib/format.ts`, 2026-11-02)
"방금 · n분 전 · n시간 전 · 어제 · 11.2 · 2025.11.2". 커뮤니티 글·댓글, 설문 카드·상세 등록일.

### `formatDate` (`src/lib/format.ts`, 2026-10-29)
날짜를 `"2026.10.29"` 형식으로. 포인트 내역 등에서 사용.

### 포인트 내역 (마이 탭 `src/app/(tabs)/my.tsx`, 2026-10-29)
`point_ledger`(본인 것만 읽힘)의 confirmed 기록을 최신순으로. 설문 응답 기록은 `ref_id`(설문 번호)로 설문 이름을 붙인다.

### `Text`, `TextInput` (`src/components/ui/Text.tsx`, 2026-10-31)
앱 글꼴(Pretendard)을 입힌 글자·입력칸. **react-native의 Text·TextInput 대신 항상 이것**을 쓴다 (lint가 막음). 굵기는 `fontWeight` "400"·"600"·"700"·"800". 글꼴은 `src/app/_layout.tsx`에서 불러온다. 색·둥글기·그림자는 `src/constants/theme.ts`(`colors`, `radius`, `shadow`).
```tsx
import { Text, TextInput } from "@/components/ui/Text";
```

### 디자인 공통 부품 (`src/components/ui/`, 2026-10-31)
화면을 새로 만들거나 고칠 때 먼저 이걸 쓴다.
| 부품 | 쓰임 |
|---|---|
| `Card` | 흰 카드 (`onPress` 주면 누를 수 있음) |
| `Button` | `variant` primary(파랑)·soft(연파랑)·outline(테두리), `small`, `loading` |
| `Chip` | 알약 선택 칩 (`selected`). 여러 개 묶음은 `create/Chips` |
| `Segmented` | 탭 전환 (진행 중·완료 등) |
| `TextTabs` | 글자 탭 + 밑줄 (카테고리·글 종류, 옆으로 넘김) |
| `PasswordInput` | 비밀번호 입력칸 + 👁 보기/가리기 (secureTextEntry 대신 항상 이것) |
| `Fab` | 오른쪽 아래 둥근 버튼 (부모 View 안에 absolute). 커뮤니티 글 만들기 |
| `SelectButton` | `[추천순 ▾]` 선택 버튼 → 아래에서 선택 창. `defaultValue`가 아니면 파랗게 (필터 걸림 표시) |
| `Badge` | 상태 표시 `tone` primary·accent·muted·danger |
| `ProgressBar` | 진행 막대 `value` 0~1 |
| `OptionRow` | 설문 응답 선택지 카드. 글자 왼쪽 · 표시 오른쪽, 고르면 파란 테두리 + 체크 동그라미 (`multiple`이면 둥근 네모). 동의 체크에는 쓰지 않는다 → `CheckRow` (2026-11-12) |
| `CheckRow` | 작은 체크 한 줄 (동의 문구: 보상 연락처 · 제휴 문의) |
| `BottomSheet` | 아래에서 올라오는 창. `onClose` · `closeLabel`("나중에 할게요") · `decoration`(창 위 그림) · `keyboard`(입력칸 있을 때). 미션 상세 · 응답 완료 연락처. **새 바텀시트는 항상 이것으로** (2026-11-12) |
| `BottomBar` | 화면 맨 아래 고정 버튼 줄. `note`를 주면 버튼 위 가운데에 작은 안내 한 줄 (2026-11-14) |
| `GrowBar` | 막대가 0에서 스르르 차오르는 움직임 (`pct` 0~100, `direction` width·height, 0.6초, 동작 줄이기면 바로). 결과 화면 막대 (2026-11-14) |
| `Hop` | 캐릭터가 한 번 콩 뛰는 움직임 (응답 완료 · 등록 완료). 동작 줄이기면 가만히 (2026-11-14) |
| `HeaderBack` | 위쪽 왼쪽 버튼 (나가기 전 확인 창이 필요한 화면). `icon="close"`면 X (설문 응답) |
| `SectionHeader` | 묶음 제목 + 설명 + "전체 보기 ›" |
| `EmptyState` | 빈 목록 안내 (그림 + 제목 + 설명) |
| `Logo` | 제목줄 로고 |

설문 한 개 카드는 `src/components/SurveyListCard.tsx` (홈·설문 목록 공용).
목록 카드 모양(여백·글씨·포인트 알약)은 `src/components/listCardStyles.ts` 한 곳에서 설문 탭·데이터 탭이 같이 쓴다 (2026-11-09 피그마 116:329).

### 내가 쓴 글 (`src/app/my-posts.tsx`, 2026-11-10)
- `supabase.rpc("get_my_posts")` → 내 글 `[{ id, kind, question, moderation, created_at, votes, comment_count }]`, `supabase.rpc("get_my_comments")` → 내 댓글 `[{ id, body, moderation, created_at, target_type, target_id, target_title, today }]`. 본인 것만, 내가 지운 것 제외

### 내 데이터 (`src/components/MyDataPanel.tsx`, 2026-11-09)
- 마이 탭 세 번째 탭 [내 설문 | 포인트 내역 | 내 데이터] 안에서 [응답한 | 스크랩 | 열람한] 결과를 한 곳에 (학생만)
- 새 서버 함수 없음: `get_hub_list`(answered·스크랩 번호로 거름) · `get_my_bookmarks` · `get_my_views`. 마이 탭 "열람한 결과" 탭과 데이터 탭 "내가 응답한 결과" 줄을 여기로 옮겼다. 데이터 탭 "스크랩 N" 거르기 칩은 그대로

### 운영자 화면 (`src/app/admin/`, `src/lib/admin.ts`, 2026-10-31)
팀 운영자 계정(`profiles.role = 'admin'`)만. 마이 탭 맨 위 🛠 운영 카드(`fetchAdminCounts`가 운영자가 아니면 null) → `admin/index.tsx` [신고 | 의견 | 단체]. 답변은 `admin/reply.tsx`, 단체 거절 사유는 `admin/reject.tsx`. 서버 함수는 모두 함수 안에서 운영자인지 다시 확인한다 (docs/DB.md `admin_*`).

### 카드 · 목록 한 줄 (`src/components/ui/Card.tsx` · `ListRow.tsx`, 2026-11-10)
- `Card` 기본 = 평평한 카드 (얇은 회색 테두리 · 그림자 없음 · 모서리 20 · 여백 20 · 간격 12). 그림자는 눌러서 들어가는 목록 카드에만: `listCardStyles.card` (설문·데이터 탭, 홈 설문, 마이 내 설문). 강조는 `style`에 `borderColor`
- `ListRow`: 카드 안 한 줄. `title` · `sub` · 오른쪽 `value`(`valueTone` primary/danger/text) 또는 `right` · `icon` · `onPress`면 › 화살표. 첫 줄은 `first`(위 선 없음)
- 줄만 담는 카드는 `<Card style={rowsCard}>` (위아래 여백·줄 간격 줄임). 쓰는 곳: 내 정보, 포인트 안내, 마이 포인트 내역·임시저장, 내 데이터, 내가 쓴 댓글
- 묶음 제목은 `SectionHeader`

### 푸시 알림 (`src/lib/push.ts` · `src/hooks/usePush.ts`, 2026-11-10)
- 앱 1.0.1 이상 폰에서만 (`canUseNotifications`, `src/lib/nativeFeatures.ts`). 알림 부품은 필요할 때만 불러와서 옛 APK·웹에서는 아무것도 안 함
- 루트 레이아웃 `usePush()`: 앱 시작·로그인 때 허락돼 있으면 알림 주소 다시 등록 · 알림 누르면 `data.url` 화면으로
- 오늘의 질문 첫 답변 직후 한 번 "매일 알림 받을까요?" (`shouldAskPush` → `enablePush`), 내 정보 "알림" 켜기/끄기, 로그아웃 때 `disablePushOnThisDevice`
- 웰컴 미션 알림(2026-11-12): 저녁 7시 `send_mission_push`, 안드로이드 채널 `mission`("웰컴 미션"), 내 정보 "웰컴 미션 알림" 켜기/끄기, 미션 화면 처음 볼 때 한 번 "매일 미션 알림 받을까요?" (`shouldAskMissionPush`). 오늘의 질문 알림과 따로
- 안드로이드는 Expo Go로 원격 알림을 못 받음 → 테스트는 새 APK로. Firebase(FCM) 설정이 있어야 알림 주소가 나옴

### ☰ 메뉴 `SideMenu` · `MenuButton` (`src/components/SideMenu.tsx`, 2026-11-10)
- 홈 제목줄 오른쪽 ☰ → 오른쪽에서 밀려 나오는 메뉴 (새 라이브러리 없이 `Modal` + `Animated`). 아이콘은 `menuIcons`
- 나누는 기준(푸망 방식): 메뉴 = 앱 안 이동·서비스 안내(홈·검색·옛썰 소개·의견 보내기·제휴 문의·약관·로그아웃) / 마이 탭 = 내 정보·내 기록
- 로그아웃은 `confirmLogout` (`src/lib/logout.ts`): 확인 창 → 이 기기 알림 끄기 → 로그아웃. 내 정보 화면과 같이 씀

### 웰컴 14일 미션 (`src/app/missions/`, `src/components/missions/`, `src/lib/missions.ts`, 2026-11-12)
- DB: `20261112000001_welcome_missions.sql` (미션 표·진행·받은 기록·나에 대해). 1일차 = 미션 화면을 처음 연 날(`start_missions`), 하루 하나씩 열림, 열린 미션은 늦게 해도 됨
- 화면: 홈 배너 `WelcomeBanner` · 미션 메인 `/missions`(길 `MissionRoad`) · 상세 시트 `MissionSheet` · 완료 팝업 `MissionComplete` · OX 퀴즈 `/missions/quiz` · 나에 대해 `/missions/about-me`
- 지급: 미션 화면·홈에 오면 `claimReadyMissions`가 받기를 요청 → 서버 `claim_mission`이 조건(기존 활동 기록)·열림·중복 확인 후 지급 + 1주·14일 보너스. 앱은 금액을 정하지 않음
- 앱을 켤 때 미션 기간이면 미션 화면을 한 번 띄움(첫 사용 안내 다음, "오늘 하루 보지 않기"), 이때 오늘의 질문 팝업은 안 띄움
- 미션 문구·순서·횟수·보상 등급은 `missions` 표, 금액은 `point_rules`. 칸의 짧은 이름·분류·3단계 안내는 앱 `MISSION_LABELS`·`MISSION_GUIDES`(code 기준). OX 퀴즈 정답은 `missions.meta`(앱에서 못 읽음), 문제 글은 `quiz.tsx` — 순서를 같이 바꿀 것
- 디자인 원본: `docs/design/welcome-mission/`

### 오류 자동 수집 Sentry (`src/lib/sentry.ts`, 2026-11-10)
- 조직 `yessur` · 프로젝트 `react-native` (sentry.io). DSN = `EXPO_PUBLIC_SENTRY_DSN` (.env · EAS), 빌드 때 오류 위치 정보 올리기 = EAS 비밀 값 `SENTRY_AUTH_TOKEN`
- 오류만 (화면 녹화·성능 추적 끔, `sendDefaultPii: false`). 개발 중·옛 APK(1.0.0)에서는 꺼짐. 루트 레이아웃을 `wrapWithSentry`로 감쌈
- 원격 업데이트 뒤 위치 정보 올리기: `npx sentry-expo-upload-sourcemaps dist` (SENTRY_AUTH_TOKEN 필요)

### 앱 버전 · 원격 업데이트 (2026-11-10)
- `app.json` version = 원격 업데이트 대상 (`runtimeVersion: appVersion`). 1.0.1 APK부터 알림·도넛·진동·사진 고르기·Sentry 부품이 들어 있음. 1.0.0 APK는 `src/lib/nativeFeatures.ts`로 막음
- 앱 안쪽 부품(네이티브 모듈)을 새로 넣으면 버전을 올리고 APK를 다시 빌드할 것

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

### 설문 보상 연락처 (2026-11-07)
- `src/lib/rewards.ts` `fetchSurveyReward(id)` → 보상 안내 글 또는 null
- 작성: `SurveyDraft.rewardNote`(적으면 보상 설문, `hasReward`·`rewardValid`) + `rewardAgreed` → 등록 뒤 `set_survey_reward`
- 보기: `RewardNotice`(안내 상자, 링크 확인 후 열림) · 응답 완료 `RewardContactForm`(번호 + 제3자 제공 동의, `onSaved` = 남긴 뒤 · 응답 완료 화면은 카드 → BottomSheet 안에 넣음) · 작성자 `results/RewardContactsBox`(번호 보기·복사·모두 지우기)
- 목록: `SurveyCard.has_reward` → 카드 🎁 뱃지, 설문 탭 🎁 보상 칩
- 작은 동의 체크: `src/components/ui/CheckRow.tsx`

### 제휴·광고 문의 (2026-11-07)
- 화면 `src/app/partnership.tsx` → `send_partnership_inquiry(...)`. 내가 보낸 문의는 `partnership_inquiries` 표를 바로 읽음(RLS 본인만)

### 설문 태그 (2026-11-07)
- `src/lib/tags.ts`: `Tag` 타입, `fetchTags()`(고를 수 있는 태그), `fetchTagSuggestions()`(카테고리 번호 → 추천 태그 번호, 표가 비면 빈 값 → 전체 태그 표시, 2026-11-12), `formatTag(name)` → `#이름`
- 붙이기: 설문 등록 성공 뒤 `supabase.rpc("set_survey_tags", { p_survey_id, p_tag_ids })` (`src/app/create.tsx`)
- 카드 표시: `src/components/TagRow.tsx` (`onPress`로 누른 태그를 넘김). 설문 탭은 주소 `?tagId=&tagName=`이 필터, 데이터 탭은 화면 상태
- 목록: `fetchOpenSurveys`는 `survey_tags(tags(id, name))`, 데이터 탭은 `get_hub_list` 결과의 `tags`

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

## 앱 빌드·원격 업데이트 (2026-11-03)

- 앱 이름 "옛썰", 안드로이드 패키지 `com.yessur.app` (Play에 올리면 못 바꿈), 버전 번호는 EAS가 관리(`appVersionSource: remote`)
- `eas.json`: `preview` = 내부 테스트용 APK (채널 `preview`), `production` = Play 스토어용 (채널 `production`)
- Supabase 주소·공개 키는 `.env`가 빌드에 안 올라가서 EAS 환경 변수(preview·production)에 따로 등록해 둠. 키를 바꾸면 `npx eas-cli@latest env:update`로 같이 바꿀 것
- 설치 파일 새로 만들기 (네이티브 라이브러리 추가·app.json 변경 때만): `npx eas-cli@latest build -p android --profile preview`
- 화면·기능만 고쳤을 때 (JS만): `npx eas-cli@latest update --channel preview --environment preview --message "무엇을 고쳤는지"` → 팀원이 앱을 껐다 켜면(최대 두 번) 반영
- 원격 업데이트는 `runtimeVersion`(= 앱 버전 1.0.0)이 같은 설치 파일에만 간다. 버전을 올리면 새로 빌드해야 함
