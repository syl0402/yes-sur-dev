// 홈 "추천 설문" 가로 넘기기용 좁은 카드 (2026-11-10 피그마 홈 시안 145:3042)
// 위: 표시 알약(카테고리 · 우리 학교 · 보상) / 제목 / #태그  →  아래: 시간 · 등록일 · 얼마 전 / 올린 곳
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import { listCardStyles } from "@/components/listCardStyles";
import TagRow from "@/components/TagRow";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { homeIcons } from "@/constants/icons";
import { colors } from "@/constants/theme";
import { formatAgo, formatShortDate } from "@/lib/format";
import { type SurveyCard, formatHost } from "@/lib/surveys";
import { encodeTags } from "@/lib/tags";

// 피그마 164 × 210
export const MINI_CARD_WIDTH = 164;

export default function SurveyMiniCard({ survey: s }: { survey: SurveyCard }) {
  const created = formatShortDate(s.created_at);
  const ago = formatAgo(s.created_at);
  return (
    <Card
      onPress={() => router.push({ pathname: "/survey/[id]", params: { id: String(s.id) } })}
      style={[listCardStyles.card, styles.card]}
    >
      <View style={styles.badges}>
        <Badge label={s.category_name} tone="blue" />
        {s.audience === "campus" && <Badge label="우리 학교" tone="lime" />}
        {s.has_reward && <Badge label="보상" tone="peach" />}
      </View>
      <View style={styles.body}>
        <Text style={listCardStyles.title} numberOfLines={2}>
          {s.title}
        </Text>
        {/* 태그를 누르면 설문 탭에서 그 태그로 걸러 보기 */}
        <TagRow
          tags={s.tags}
          onPress={(t) => router.navigate({ pathname: "/surveys", params: { tags: encodeTags([t]) } })}
        />
      </View>
      <View style={styles.foot}>
        <View style={listCardStyles.meta}>
          <View style={listCardStyles.metaIcon}>
            <AppIcon name={homeIcons.timeFill} size={11} color={colors.cardSub} />
            <Text style={listCardStyles.sub}>약 {s.est_minutes}분</Text>
          </View>
          <Text style={listCardStyles.sub} numberOfLines={1}>
            {ago !== created ? ago : `등록 ${created}`}
          </Text>
        </View>
        <View style={listCardStyles.metaIcon}>
          <AppIcon name={homeIcons.host} size={11} color={colors.cardSub} />
          <Text style={[listCardStyles.sub, styles.host]} numberOfLines={1}>
            {formatHost(s)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    width: MINI_CARD_WIDTH,
    minHeight: 210,
    padding: 16,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  foot: {
    gap: 2,
  },
  host: {
    flexShrink: 1,
  },
});
