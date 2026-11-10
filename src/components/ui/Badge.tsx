// 작은 상태 표시 (예: 진행 중 · 완료 · 생활). 2026-10-31 디자인, 2026-11-09 피그마 카드(높이 20 알약) 반영
// primary: 연파랑 + 파란 글자 · accent: 연연두 + 진한 초록 글자 · muted: 회색 · danger: 빨강 · hot: 커뮤니티 HOT
// blue·lime·peach: 목록 카드의 파스텔 표시 (2026-11-10 피그마 값: 바탕 + 같은 계열 진한 글자, 12 세미볼드)
// size "sm": 글자 10 (홈 추천 카드처럼 좁은 카드)
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius } from "@/constants/theme";

export type BadgeTone = "primary" | "accent" | "muted" | "danger" | "hot" | "solid" | "blue" | "lime" | "peach";

const tones: Record<BadgeTone, { bg: string; fg: string }> = {
  primary: { bg: colors.primarySoft, fg: colors.primary },
  accent: { bg: colors.accentSoft, fg: colors.onAccentSoft },
  muted: { bg: colors.surfaceMuted, fg: colors.textMuted },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  hot: { bg: colors.hotSoft, fg: colors.hot },
  // 진한 파랑 바탕 + 흰 글자 ("내 설문"처럼 눈에 띄어야 할 때, 2026-11-10)
  solid: { bg: colors.primary, fg: colors.surfaceSubtle },
  // 목록 카드: 카테고리 · 우리 학교 · 보상 (2026-11-09 피그마)
  blue: { bg: colors.pastelBlue, fg: colors.pastelBlueText },
  lime: { bg: colors.pastelLime, fg: colors.pastelLimeText },
  peach: { bg: colors.pastelPeach, fg: colors.pastelPeachText },
};

export default function Badge({ label, tone = "primary", size }: { label: string; tone?: BadgeTone; size?: "sm" }) {
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }, size === "sm" && styles.smallText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
  },
  text: {
    fontSize: fontSize.caption,
    lineHeight: 20,
    fontWeight: "600",
  },
  smallText: {
    fontSize: 10,
  },
});
