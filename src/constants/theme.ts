// 앱 전체 색·글꼴·글자 크기·간격·둥글기·그림자. 화면에서는 여기 값만 쓴다 (디자인이 바뀌면 이 파일만 고친다).
// 2026-10-31 디자인 시안(로고·마스코트·화면 시안) 반영: 메인 블루 #3157D5 · 서브 라임 #B7E65A · 텍스트 네이비 #17233C · 배경 #F5F7FF

export const colors = {
  // 브랜드
  primary: "#3157D5",
  // 대표 색을 옅게 (선택된 칩·뱃지·아이콘 바탕)
  primarySoft: "#ECF0FC",
  // 강조 (별·포인트·완료 뱃지). 흰 바탕 위 글자색으로 쓰지 않는다 (잘 안 읽힘) → 바탕으로 쓰고 글자는 onAccent
  accent: "#B7E65A",
  accentSoft: "#F1FADF",
  onAccent: "#17233C",
  // 연연두 바탕 위 글자 (완료 뱃지·적립 표시)
  onAccentSoft: "#4F7A12",

  // 글자
  text: "#17233C",
  textMuted: "#6B7489",
  textSubtle: "#A0A7B6",

  // 바탕
  background: "#F5F7FF", // 화면 바탕
  surface: "#FFFFFF", // 카드·입력칸·하단 탭
  surfaceMuted: "#F2F4F8", // 카드 안 회색 상자·꺼진 칩
  border: "#E3E7F0",

  // 상태
  danger: "#E5484D",
  dangerSoft: "#FDECEC",
  disabled: "#C5CAD6",
  onPrimary: "#FFFFFF",
  // 목록 창 뒤를 어둡게 덮는 색
  overlay: "rgba(23, 35, 60, 0.4)",
};

// 글꼴: Pretendard (assets/fonts, SIL OFL 무료). 굵기는 fontWeight "400"·"600"·"700"·"800"으로 고른다
export const fontFamily = "Pretendard";

export const fontSize = {
  hero: 32,
  title: 22,
  subtitle: 18,
  body: 16,
  small: 13,
  caption: 12,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

// 모서리 둥글기
export const radius = {
  sm: 8, // 작은 상자·뱃지
  md: 12, // 버튼·입력칸
  lg: 16, // 카드
  pill: 999, // 칩·알약 모양
};

// 카드 그림자 (아주 옅게. 테두리와 함께 쓴다)
export const shadow = {
  card: {
    shadowColor: "#17233C",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
};
