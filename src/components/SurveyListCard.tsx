// 설문 한 개 카드 (홈·설문 목록). 계열 뱃지 · 제목 · 시간·주최·마감 · 보상 (2026-10-31 디자인)
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { homeIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatPoints, formatTimeLeft } from "@/lib/format";
import { type SurveyCard, formatHost } from "@/lib/surveys";

export default function SurveyListCard({ survey: s }: { survey: SurveyCard }) {
  const timeLeft = formatTimeLeft(s.closes_at);
  return (
    <Card onPress={() => router.push({ pathname: "/survey/[id]", params: { id: String(s.id) } })}>
      <View style={styles.top}>
        <Badge label={s.category_name} />
        {timeLeft ? <Text style={styles.timeLeft}>{timeLeft}</Text> : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {s.title}
      </Text>
      <View style={styles.bottom}>
        <View style={styles.meta}>
          <AppIcon name={homeIcons.time} size={14} color={colors.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {[`약 ${s.est_minutes}분`, formatHost(s)].filter(Boolean).join(" · ")}
          </Text>
        </View>
        <View style={styles.reward}>
          <Text style={styles.rewardText}>+{formatPoints(s.reward_points)}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeLeft: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  title: {
    fontSize: fontSize.subtitle,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 25,
  },
  bottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  meta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  metaText: {
    flexShrink: 1,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  // 보상: 연연두 알약 (브랜드 라임)
  reward: {
    paddingVertical: spacing.xs,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  rewardText: {
    fontSize: fontSize.small,
    fontWeight: "800",
    color: colors.onAccentSoft,
  },
});
