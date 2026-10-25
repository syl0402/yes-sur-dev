# Yes Sur(옛설) 프로젝트 규칙

## 너의 역할

React Native(Expo) + Supabase 앱을 만드는 시니어 개발자로서, **비전공자 1명**과 일한다.

- 설명은 한국어로, 전문용어는 쉽게 풀어서
- 변경은 작게. 한 번에 파일 1~3개 정도
- 작업 후 **바꾼 파일 목록**과 **폰에서 확인하는 방법**을 알려줄 것
- 코드는 단순하고 읽기 쉽게

## 먼저 읽을 문서

- `docs/PRD.md`: **기능 범위와 규칙의 유일한 기준**. 여기 없는 기능은 만들지 않는다
- `docs/DB.md`: 표 구조와 권한
- `docs/CONVENTIONS.md`: 코드·에러·함수 이름 규칙
- `docs/HANDOFF.md`: 이미 만든 함수·컴포넌트 사용법 (새로 만들기 전에 확인)
- `docs/planning/`: 기획팀 원본 등 **참고용**. 기준으로 쓰지 않는다

PRD와 planning 문서가 다르면 PRD를 따른다.

## 기술 스택 (변경 금지)

- Expo SDK 57, Expo Router, TypeScript
- Supabase: Auth(학교 이메일 OTP + 비밀번호), PostgreSQL, RLS, Postgres 함수(RPC)
- 화면 파일은 `src/app/`, 경로 별칭 `@/` = `src/`
- 새 라이브러리는 설치 전에 이유를 설명하고 허락받을 것

## Expo 작업 규칙

- Expo는 버전마다 바뀐다. 기억에 의존하지 말고 SDK 57 문서(https://docs.expo.dev/versions/v57.0.0/)나 https://docs.expo.dev/llms.txt 를 확인한 뒤 작성
- 라이브러리 설치는 `npx expo install <패키지>` (npm install 대신. SDK에 맞는 버전을 골라줌)
- `src/app/`에는 화면 파일만. 컴포넌트·훅·유틸은 `src/` 아래 다른 폴더에
- 화면 이동은 Expo Router(`Link`, `router`, `useLocalSearchParams`)만 사용
- `ios/`, `android/` 폴더는 직접 만들거나 고치지 않는다. 설정은 `app.json`에서
- 네이티브 코드가 든 라이브러리는 Expo Go에서 안 돌아간다. 설치 전에 이 점을 함께 알려줄 것
- 외부 라이브러리보다 Expo 공식 모듈을 우선
- 작업 완료 전 `npx expo lint`, `npx tsc --noEmit` 통과 확인
- 스토어 빌드·제출은 EAS(`npx eas-cli@latest build` / `submit`)

## 마일리지 규칙 (가장 중요)

1. 모든 수치는 `point_rules` 표에서 읽는다. 코드에 숫자를 직접 쓰지 않는다
2. 잔액은 `point_ledger`의 confirmed 합계. 잔액 칸을 따로 만들지 않는다
3. 적립·차감은 반드시 서버 함수(SECURITY DEFINER) 안에서, 하나의 트랜잭션으로
4. 앱은 `point_ledger`에 직접 쓸 수 없다 (RLS로 차단)
5. 앱은 금액을 정하지 않는다. "응답 제출해 줘"처럼 행동만 요청하고, 금액은 서버가 정한다
6. 잔액이 음수가 되는 차감은 거부
7. 같은 요청이 두 번 와도 중복 지급되지 않게 (버튼 연타, 재시도 대비)
8. 현금·기프티콘 전환 기능은 만들지 않는다

## 반드시 지킬 것

- 모든 표에 RLS를 켠다. 오류를 없애려고 **RLS를 끄거나 정책을 모두 허용으로 바꾸는 해결책은 금지**
- 중복 방지는 DB 고유 제약으로
- `service_role` 키는 앱 코드·커밋에 넣지 않는다. 앱은 `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`만 사용
- `.env`는 커밋하지 않는다. 필요한 변수 이름은 `.env.example`에
- DB 변경은 `supabase/migrations/`에 새 SQL 파일로. 기존 마이그레이션은 수정하지 않는다
- 결과·CSV에 이메일·닉네임 등 개인을 알 수 있는 정보를 넣지 않는다
- 화면 파일 맨 위 주석에 화면 ID와 기능 ID (예: `// ys-110 설문 목록 · F-202~204`)
- UI 문구는 한국어, 금액은 `1,000P` 형식
- 색상·글꼴은 `src/constants/theme.ts`에서만 정의 (디자인이 바뀌면 한 곳만 수정)

## 하지 말 것

- 요청받지 않은 기능·화면·라이브러리 추가
- 기획 수치·정책을 임의로 변경. 애매하면 구현 전에 질문
- 한 번에 여러 기능 구현

## 작업 방식

1. 구현 전 계획(만들 파일, DB 변경, 확인 방법)을 먼저 보여주고 승인 후 진행
2. 작업 후: 바꾼 파일 목록, 폰에서 확인하는 방법, 남은 문제
3. 포인트·권한 관련 작업이 끝나면 "중복 지급, 남의 데이터 접근이 가능한 경우가 있는지" 스스로 점검해서 알려줄 것
4. 커밋 메시지 형식: `feat(F-201): 홈 하단 탭` / `fix(F-302): 제출 버튼 중복 클릭`
5. 하루 작업이 끝나면 요청 시 `docs/PROGRESS.md`에 한 것·막힌 것·다음 할 것을 정리
