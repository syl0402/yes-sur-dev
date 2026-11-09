// 설문 한 개 카드 (홈·설문 목록). 계열 뱃지 · 제목 · #태그 · 시간·주최·마감 · 보상 (2026-10-31 디자인, 태그 2026-11-07, 내 설문 표시 2026-11-10)
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import TagRow from "@/components/TagRow";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { homeIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatAgo, formatPoints, formatTimeLeft } from "@/lib/format";
import { type SurveyCard, formatHost } from "@/lib/surveys";
import { encodeTags, type Tag } from "@/lib/tags";

type Props = {
  survey: SurveyCard;
  // 태그를 눌렀을 때 (설문 탭: 그 자리에서 걸러 보기). 없으면 설문 탭으로 이동해서 걸러 보기 (홈)
  onTagPress?: (tag: Tag) => void;
};

export default function SurveyListCard({ survey: s, onTagPress }: Props) {
  const timeLeft = formatTimeLeft(s.closes_at);
  const pressTag =
    onTagPress ??
    ((t: Tag) => router.navigate({ pathname: "/surveys", params: { tags: encodeTags([t]) } }));
  return (
    <Card
      onPress={() => router.push({ pathname: "/survey/[id]", params: { id: String(s.id) } })}
      style={s.mine && styles.mineCard}
    >
      <View style={styles.top}>
        <View style={styles.badges}>
          {s.mine && <Badge label="내 설문" tone="solid" />}
          <Badge label={s.category_name} />
          {s.audience === "campus" && <Badge label="우리 학교" tone="accent" />}
          {s.has_reward && <Badge label="🎁 보상" tone="hot" />}
        </View>
        {timeLeft ? <Text style={styles.timeLeft}>{timeLeft}</Text> : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {s.title}
      </Text>
      <TagRow tags={s.tags} onPress={pressTag} />
      <View style={styles.bottom}>
        <View style={styles.meta}>
          <AppIcon name={homeIcons.time} size={14} color={colors.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {[`약 ${s.est_minutes}분`, formatHost(s), formatAgo(s.created_at)].filter(Boolean).join(" · ")}
          </Text>
        </View>
        {/* 내 설문은 내가 받을 보상이 아니라 모인 응답 수 */}
        {s.mine ? (
          <Text style={styles.progressText}>
            응답 {s.response_count}/{s.target_responses}명
          </Text>
        ) : (
          <View style={styles.reward}>
            <Text style={styles.rewardText}>+{formatPoints(s.reward_points)}</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  // 내 설문: 파란 테두리 + 아주 옅은 파랑 바탕 (2026-11-10)
  mineCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badges: {
    flexDirection: "row",
    gap: spacing.xs,
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
  progressText: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.primary,
  },
});
