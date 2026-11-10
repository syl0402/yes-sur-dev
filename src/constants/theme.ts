// 앱 전체 색·글꼴·글자 크기·간격·둥글기·그림자. 화면에서는 여기 값만 쓴다 (디자인이 바뀌면 이 파일만 고친다).
// 2026-10-31 디자인 시안(로고·마스코트·화면 시안) 반영: 메인 블루 #3157D5 · 서브 라임 #B7E65A · 텍스트 네이비 #17233C · 배경 #F5F7FF (2026-11-09 흰색으로 변경)
// 2026-11-10 디자인팀 컬러 시스템(피그마 변수 Blue·Lime·Natural 50~900) 반영. 주석의 단계 이름 = 피그마 변수 이름

export const colors = {
  // 브랜드
  primary: "#3157D5", // Blue 500
  // 대표 색을 옅게 (선택된 칩·뱃지·아이콘 바탕)
  primarySoft: "#E3E9FF", // Blue 100
  // 대표 색 중간 밝기 (결과 막대에서 1위가 아닌 보기)
  primaryMuted: "#9FB2FF", // Blue 300
  // 흰 바탕 위 파란 글자 (홈 바로가기 이름, 2026-11-10 피그마)
  primaryStrong: "#2949B5", // Blue 600
  // 강조 (별·포인트·완료 뱃지). 흰 바탕 위 글자색으로 쓰지 않는다 (잘 안 읽힘) → 바탕으로 쓰고 글자는 onAccent
  accent: "#A3EA16", // Lime 500
  accentSoft: "#F0F8D5", // Lime 100
  onAccent: "#202A40", // Natural 900
  // 연연두 바탕 위 글자 (완료 뱃지·적립 표시)
  onAccentSoft: "#506D23", // Lime 800 (700은 연연두 위 글자로 흐림)

  // 글자
  text: "#202A40", // Natural 900
  textMuted: "#70798D", // Natural 600
  textSubtle: "#8B93A5", // Natural 500

  // 바탕
  background: "#FCFCFC", // 화면 바탕 Natural 30 (2026-11-09 흰색 → 2026-11-10 Natural 30)
  surface: "#FFFFFF", // 카드·입력칸·하단 탭
  surfaceMuted: "#EFF1F7", // 카드 안 회색 상자·꺼진 칩 · Natural 100
  border: "#E2E5EE", // Natural 200

  // 상태
  danger: "#E5484D",
  dangerSoft: "#FDECEC",
  // 커뮤니티 HOT 표시 (롤링 줄 제목·🔥 HOT 뱃지, 2026-11-03)
  hot: "#E5484D",
  hotSoft: "#FDECEC",
  // 목록 카드 (2026-11-09 피그마 카드 디자인 116:329): 제목 진회색 · 보조 글씨 회색 · 표시 바탕 파스텔 3색
  cardTitle: "#2F3133",
  cardSub: "#757B80",
  pastelBlue: "#E3E9FF", // 카테고리 · Blue 100
  pastelLime: "#F0F8D5", // Lime 100 · 우리 학교 · 신뢰도 높음
  pastelPeach: "#FFE2D6", // 보상
  disabled: "#CDD2DF", // Natural 300
  // 그래프: 강조하지 않는 막대 (1위만 파랑, 나머지는 이 회색, 2026-11-10)
  chartMuted: "#CDD2DF", // Natural 300
  onPrimary: "#FFFFFF",
  // 파란 카드 위 흐린 흰색 (마이 포인트 카드 원 장식, 2026-11-10)
  onPrimarySoft: "rgba(255, 255, 255, 0.12)",
  // 홈 포인트 카드 오른쪽 아래 큰 원 (마스코트가 올라선 행성, 2026-11-10 피그마) · Blue 300 반투명
  onPrimaryPlanet: "rgba(159, 178, 255, 0.6)",
  // 목록 창 뒤를 어둡게 덮는 색
  overlay: "rgba(32, 42, 64, 0.4)", // Natural 900 40%
};

// 그래프 파랑 4단계 (진함 → 옅음) + 미입력 회색. 응답자 구성처럼 순서가 있는 묶음을 한 막대에 나눌 때 (2026-11-10)
// 이웃한 색끼리 일반 시력·색맹 모두 구분되는지 검사함 (dataviz validate_palette, ΔE ≥ 15)
export const chartRamp = ["#1F3A99", "#3F65DB", "#86A0EC", "#CAD5F7"];
export const chartUnknown = "#7B8396";

// 글꼴: Pretendard (assets/fonts, SIL OFL 무료). 굵기는 fontWeight "400"·"500"·"600"·"700"·"800"으로 고른다 (이 다섯 개만. 다른 값은 기본 글꼴로 보일 수 있음)
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
  xl: 20, // 설문·데이터 목록 카드 (2026-11-09 피그마)
  pill: 999, // 칩·알약 모양
};

// 카드 그림자 (아주 옅게. 테두리와 함께 쓴다)
export const shadow = {
  card: {
    shadowColor: "#202A40",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  // 눌러서 들어가는 목록 카드에만: 테두리 없이 그림자 (2026-11-09 피그마 20% → 2026-11-10 눈 피로 줄이려고 12%)
  listCard: {
    shadowOpacity: 0,
    elevation: 0,
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.12)",
  },
};
