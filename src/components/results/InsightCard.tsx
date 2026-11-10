import { StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import { Text } from "@/components/ui/Text";
import { insightIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import type { Insight } from "@/lib/resultSummary";

// 결과 맨 위 "핵심 인사이트" (규칙으로 만든 문장 3~4개). 없으면 그리지 않는다
// title·footer: 열람 전 미리보기처럼 제목·아래 안내를 바꿀 때
// 2026-11-10: 테두리 카드 → 연파랑 요약 상자, 이모지 → 선 아이콘 (마이 탭과 같은 톤)
export default function InsightCard({ insights, title = "핵심 인사이트", footer }: { insights: Insight[]; title?: string; footer?: string }) {
  if (insights.length === 0) return null;
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title}</Text>
      {insights.map((it, i) => {
        const icon = insightIcons[it.emoji];
        return (
          <View key={i} style={[styles.row, i > 0 && styles.divider]}>
            <View style={styles.icon}>
              {icon ? <AppIcon name={icon} size={18} color={colors.primary} /> : <Text style={styles.emoji}>{it.emoji}</Text>}
            </View>
            <View style={styles.main}>
              <Text style={styles.headline}>{it.title}</Text>
              <Text style={styles.detail} numberOfLines={2}>
                {it.detail}
              </Text>
            </View>
          </View>
        );
      })}
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: 18,
    gap: 4,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
  },
  title: {
    marginBottom: spacing.xs,
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.primary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  // 연파랑 위 흰 선
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  emoji: {
    fontSize: 16,
  },
  main: {
    flex: 1,
    gap: 2,
  },
  headline: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 21,
  },
  detail: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  footer: {
    marginTop: spacing.xs,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
});
