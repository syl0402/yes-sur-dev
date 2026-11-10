// 앱에서 쓰는 아이콘 이름을 한 곳에 모은다.
// 디자인팀이 아이콘을 바꾸면 이 파일의 이름만 고치면 앱 전체에 반영된다.
// 아이콘 목록: https://icons.expo.fyi (Ionicons)
import type Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";

export type IconName = ComponentProps<typeof Ionicons>["name"];

// 하단 탭
export const tabIcons = {
  home: "home-outline",
  surveys: "list-outline",
  community: "chatbubbles-outline",
  data: "bar-chart-outline",
  my: "person-outline",
} satisfies Record<string, IconName>;

// 홈 바로가기·설문 카드 (2026-10-31 디자인, 2026-11-10 피그마 홈 시안: 바로가기는 꽉 찬 아이콘 4칸)
export const homeIcons = {
  surveys: "document-text",
  create: "pencil",
  data: "stats-chart",
  community: "chatbox-ellipses",
  // 추천 설문 카드의 올린 곳 (피그마 fa-solid:university)
  host: "business",
  // 개인이 올린 설문 (피그마 bi:person-fill)
  person: "person",
  // 포인트 알약 앞 동전 (피그마 ri:copper-coin-fill과 비슷한 모양)
  coin: "radio-button-on",
  time: "time-outline",
  // 목록 카드 소요 시간 (꽉 찬 시계, 2026-11-09 피그마)
  timeFill: "time",
  sparkle: "sparkles",
  // 포인트 카드 "이번 주" 앞 별 (피그마 star-filled)
  star: "star",
} satisfies Record<string, IconName>;

// 비밀번호 보기 (2026-11-02)
export const passwordIcons = {
  show: "eye-outline",
  hide: "eye-off-outline",
} satisfies Record<string, IconName>;

// 화면 위쪽 뒤로 가기·나가기 (2026-11-03, "나가기" 글자 대신 화살표로 통일)
export const headerIcons = {
  back: "arrow-back",
} satisfies Record<string, IconName>;

// 마이 탭 바로가기 (2026-11-10, 이모지 → 아이콘)
export const myIcons = {
  feedback: "chatbubble-ellipses-outline",
  invite: "gift-outline",
  posts: "pencil-outline",
  partner: "briefcase-outline",
  forward: "chevron-forward",
} satisfies Record<string, IconName>;

// 홈 오른쪽 위 ☰ 메뉴 (2026-11-10, 푸망 방식: 앱 이동·서비스 안내)
export const menuIcons = {
  open: "menu-outline",
  close: "close-outline",
  home: "home-outline",
  search: "search-outline",
  about: "information-circle-outline",
  feedback: "chatbubble-ellipses-outline",
  partner: "briefcase-outline",
  terms: "document-text-outline",
  privacy: "shield-checkmark-outline",
  logout: "log-out-outline",
} satisfies Record<string, IconName>;

// 화면 곳곳의 작은 표시 아이콘 (2026-11-10, 기능 이모지 → 선 아이콘)
export const uiIcons = {
  search: "search-outline",
  // 오른쪽 아래 둥근 "새로 쓰기" 버튼 (2026-11-10 피그마: + → 연필)
  write: "pencil",
  // 데이터 카드: 응답 수 앞 · 열람 알약 · 우리 학교 칩 (2026-11-10 피그마)
  responses: "document-text",
  // 정렬 버튼 ▼ · 묶음 제목 오른쪽 › (2026-11-10 피그마)
  caretDown: "caret-down",
  chevron: "chevron-forward",
  read: "book",
  campus: "school",
  gift: "gift", // 피그마 bxs:gift (꽉 찬 선물)
  streak: "flame",
  alert: "alert-circle-outline",
  admin: "construct-outline",
  chart: "bar-chart-outline",
} satisfies Record<string, IconName>;

// 결과 "핵심 인사이트" 아이콘 (2026-11-10, 이모지 → 선 아이콘). 키는 인사이트 문장을 만드는 쪽의 이모지
export const insightIcons: Record<string, IconName> = {
  "💡": "bulb-outline",
  "⚖️": "git-compare-outline",
  "🔍": "search-outline",
  "⭐": "star-outline",
  "📉": "trending-down-outline",
};

// 데이터 결과 스크랩 (2026-11-10, ★ 저장 → 스크랩)
export const bookmarkIcons = {
  on: "bookmark",
  off: "bookmark-outline",
} satisfies Record<string, IconName>;
