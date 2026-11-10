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

// 홈 바로가기·설문 카드 (2026-10-31 디자인)
export const homeIcons = {
  surveys: "clipboard-outline",
  create: "add",
  data: "bar-chart-outline",
  time: "time-outline",
  // 목록 카드 소요 시간 (꽉 찬 시계, 2026-11-09 피그마)
  timeFill: "time",
  sparkle: "sparkles",
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
