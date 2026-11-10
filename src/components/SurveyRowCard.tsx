// 홈 "최신 설문 & 마감 임박" 한 줄 카드 (2026-11-10 피그마 홈 시안 145:3585)
// 왼쪽: 제목 / 소요 시간 · 상태(마감 임박이면 파란 글씨)  →  오른쪽: 파란 포인트 알약
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import { listCardStyles } from "@/components/listCardStyles";
import Card from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { homeIcons } from "@/constants/icons";
import { colors, spacing } from "@/constants/theme";
import { formatAgo, formatPoints } from "@/lib/format";
import type { SurveyCard } from "@/lib/surveys";

// "마감 임박"으로 보는 기준: 24시간 안에 마감
export const CLOSING_SOON_MS = 24 * 60 * 60 * 1000;

export function isClosingSoon(s: SurveyCard): boolean {
  if (!s.closes_at) return false;
  const left = new Date(s.closes_at).getTime() - Date.now();
  return left > 0 && left <= CLOSING_SOON_MS;
}

// 상태 글자: 마감 임박이면 "마감 3시간 전", 아니면 "방금 등록됨" · "2시간 전 등록"
function statusText(s: SurveyCard): string {
  if (isClosingSoon(s) && s.closes_at) {
    const hours = Math.floor((new Date(s.closes_at).getTime() - Date.now()) / (60 * 60 * 1000));
    return hours >= 1 ? `마감 ${hours}시간 전` : "곧 마감";
  }
  const ago = formatAgo(s.created_at);
  return ago === "방금" ? "방금 등록됨" : `${ago} 등록`;
}

export default function SurveyRowCard({ survey: s }: { survey: SurveyCard }) {
  const soon = isClosingSoon(s);
  return (
    <Card
      onPress={() => router.push({ pathname: "/survey/[id]", params: { id: String(s.id) } })}
      style={[listCardStyles.card, listCardStyles.borderCard, styles.card]}
    >
      <View style={styles.left}>
        <Text style={listCardStyles.title} numberOfLines={1}>
          {s.title}
        </Text>
        <View style={listCardStyles.meta}>
          <View style={listCardStyles.metaIcon}>
            <AppIcon name={homeIcons.timeFill} size={11} color={colors.cardSub} />
            <Text style={listCardStyles.sub}>설문 {s.est_minutes}분</Text>
          </View>
          <Text style={[listCardStyles.sub, soon && styles.soon]}>· {statusText(s)}</Text>
        </View>
      </View>
      <View style={listCardStyles.pill}>
        <AppIcon name={homeIcons.coin} size={16} color={colors.onPrimaryText} />
        <Text style={listCardStyles.pillText}>{formatPoints(s.reward_points)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  // 피그마 145:3585 값: 테두리 카드 · 위아래 12 좌우 16
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md - spacing.xs,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  left: {
    flex: 1,
  },
  soon: {
    color: colors.primary,
  },

});
