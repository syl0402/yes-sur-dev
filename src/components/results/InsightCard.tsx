import { StyleSheet, View } from "react-native";

import Card from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import type { Insight } from "@/lib/resultSummary";

// 결과 맨 위 "핵심 인사이트" (규칙으로 만든 문장 3~4개). 없으면 그리지 않는다
// title·footer: 열람 전 미리보기처럼 제목·아래 안내를 바꿀 때
export default function InsightCard({ insights, title = "핵심 인사이트", footer }: { insights: Insight[]; title?: string; footer?: string }) {
  if (insights.length === 0) return null;
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {insights.map((it, i) => (
        <View key={i} style={[styles.row, i > 0 && styles.divider]}>
          <View style={styles.icon}>
            <Text style={styles.emoji}>{it.emoji}</Text>
          </View>
          <View style={styles.main}>
            <Text style={styles.headline}>{it.title}</Text>
            <Text style={styles.detail} numberOfLines={2}>
              {it.detail}
            </Text>
          </View>
        </View>
      ))}
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: colors.primarySoft,
  },
  title: {
    fontSize: fontSize.small,
    fontWeight: "800",
    color: colors.primary,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  emoji: {
    fontSize: 18,
  },
  main: {
    flex: 1,
    gap: 2,
  },
  headline: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 22,
  },
  footer: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  detail: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
});
