// 설문 한 개 카드 (설문 탭). 2026-11-10 피그마 140:178 순서:
// 표시 알약(내 설문·카테고리·우리 학교·보상) · 남은 시간 / 제목 / #태그 / 시간 정보 · 올린 곳 + 포인트 알약
// (2026-10-31 디자인, 태그 2026-11-07, 내 설문 표시 2026-11-10, 피그마 카드 2026-11-09)
import { router } from "expo-router";
import { View } from "react-native";

import AppIcon from "@/components/AppIcon";
import { listCardStyles as styles } from "@/components/listCardStyles";
import TagRow from "@/components/TagRow";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { homeIcons } from "@/constants/icons";
import { colors } from "@/constants/theme";
import { formatAgo, formatPoints, formatShortDate, formatTimeLeft } from "@/lib/format";
import { type SurveyCard, formatHost } from "@/lib/surveys";
import { encodeTags, type Tag } from "@/lib/tags";

type Props = {
  survey: SurveyCard;
  // 태그를 눌렀을 때 (설문 탭: 그 자리에서 걸러 보기). 없으면 설문 탭으로 이동해서 걸러 보기
  onTagPress?: (tag: Tag) => void;
  // 미리보기 (설문 등록 ④ "응답자에게 이렇게 보여요"): 눌러도 아무 일 없음 (2026-11-13)
  preview?: boolean;
};

export default function SurveyListCard({ survey: s, onTagPress, preview }: Props) {
  const timeLeft = formatTimeLeft(s.closes_at);
  const created = formatShortDate(s.created_at);
  const ago = formatAgo(s.created_at);
  const pressTag = preview
    ? () => {}
    : onTagPress ??
    ((t: Tag) => router.navigate({ pathname: "/surveys", params: { tags: encodeTags([t]) } }));
  return (
    <Card
      onPress={preview ? undefined : () => router.push({ pathname: "/survey/[id]", params: { id: String(s.id) } })}
      style={[styles.card, s.mine && styles.mineCard]}
    >
      {/* 표시 알약 · 남은 시간 / 제목 / #태그 */}
      <View style={styles.head}>
        <View style={styles.top}>
          <View style={styles.badges}>
            {s.mine && <Badge label="내 설문" tone="solid" />}
            <Badge label={s.category_name} tone="blue" />
            {s.audience === "campus" && <Badge label={s.campus_label} tone="lime" />}
            {s.has_reward && <Badge label="보상" tone="peach" />}
          </View>
          {timeLeft ? <Text style={styles.topRight}>{timeLeft}</Text> : null}
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {s.title}
        </Text>
        <TagRow tags={s.tags} onPress={pressTag} />
      </View>
      <View style={styles.bottom}>
        <View style={styles.footLeft}>
          {/* 소요 시간 · 등록일 · 얼마 전 (등록일과 같으면 한 번만) */}
          <View style={styles.meta}>
            <View style={styles.metaIcon}>
              <AppIcon name={homeIcons.timeFill} size={11} color={colors.cardSub} />
              <Text style={styles.sub}>약 {s.est_minutes}분</Text>
            </View>
            <Text style={styles.sub}>· 등록 {created}</Text>
            {ago !== created ? <Text style={styles.sub}>· {ago}</Text> : null}
          </View>
          <View style={styles.metaIcon}>
            {/* 단체·학생회 = 건물, 개인 = 사람 (피그마) */}
            <AppIcon name={s.host_name ? homeIcons.host : homeIcons.person} size={11} color={colors.cardSub} />
            <Text style={[styles.sub, { flexShrink: 1 }]} numberOfLines={1}>
              {formatHost(s)}
            </Text>
          </View>
        </View>
        {/* 내 설문은 내가 받을 보상이 아니라 모인 응답 수 */}
        {s.mine ? (
          <Text style={styles.progressText}>
            응답 {s.response_count}/{s.target_responses}명
          </Text>
        ) : (
          <View style={styles.pill}>
            <AppIcon name={homeIcons.coin} size={16} color={colors.onPrimaryText} />
            <Text style={styles.pillText}>{formatPoints(s.reward_points)}</Text>
          </View>
        )}
      </View>
    </Card>
  );
}
