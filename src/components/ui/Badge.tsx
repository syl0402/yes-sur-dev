// 작은 상태 표시 (예: 진행 중 · 완료 · 생활). 2026-10-31 디자인
// primary: 연파랑 + 파란 글자 · accent: 연연두 + 진한 초록 글자 · muted: 회색 · danger: 빨강
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

export type BadgeTone = "primary" | "accent" | "muted" | "danger";

const tones: Record<BadgeTone, { bg: string; fg: string }> = {
  primary: { bg: colors.primarySoft, fg: colors.primary },
  accent: { bg: colors.accentSoft, fg: colors.onAccentSoft },
  muted: { bg: colors.surfaceMuted, fg: colors.textMuted },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
};

export default function Badge({ label, tone = "primary" }: { label: string; tone?: BadgeTone }) {
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
  },
  text: {
    fontSize: fontSize.caption,
    fontWeight: "700",
  },
});
