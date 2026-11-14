// 내가 올린 설문 카드 (마이 홈 · 내 설문 전체, 2026-11-14 마이 탭 시안 · 기존 카드 모양 그대로)
// 상태 뱃지(진행 중 · 마감 · 검토 중) · 등록일 · 제목 · 응답 진행률 막대 · 데이터 탭 공개 안내 · 아래 줄
// 아래 줄 오른쪽: 응답이 있으면 파란 "결과 보기", 진행 중인데 0명이면 글자 링크 "홍보하기 ›"(커뮤니티 설문 홍보)
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import { listCardStyles as list } from "@/components/listCardStyles";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import GrowBar from "@/components/ui/GrowBar";
import { Text } from "@/components/ui/Text";
import { uiIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatShortDate } from "@/lib/format";
import type { MySurvey } from "@/lib/mySurveys";
import { VISIBILITY_LABELS } from "@/lib/surveyDraft";

export default function MySurveyCard({ survey: s }: { survey: MySurvey }) {
  const pct = s.target > 0 ? Math.min(100, Math.round((s.responseCount / s.target) * 100)) : 0;
  // 칩은 진행 중 · 마감만 (검토 중은 운영 확인이 필요해 빨강으로 남김)
  const status = s.moderated
    ? { label: "검토 중", tone: "danger" as const }
    : s.closed
      ? { label: "마감", tone: "muted" as const }
      : { label: "진행 중", tone: "lime" as const };
  const promote = !s.closed && !s.moderated && s.responseCount === 0;

  return (
    <Card onPress={() => router.push({ pathname: "/survey/[id]", params: { id: String(s.id) } })} style={list.card}>
      <View style={list.head}>
        <View style={list.top}>
          <Badge label={status.label} tone={status.tone} />
          <Text style={list.sub}>등록 {formatShortDate(s.createdAt)}</Text>
        </View>
        <Text style={list.title} numberOfLines={2}>
          {s.title}
        </Text>
      </View>

      <View style={styles.progress}>
        <View style={list.top}>
          <Text style={list.sub}>응답 진행률</Text>
          <Text style={styles.progressNum}>
            {s.responseCount} / {s.target}명 · {pct}%
          </Text>
        </View>
        {/* 0에서 지금 값까지 차오름 (동작 줄이기면 바로) */}
        <View style={styles.track}>
          <GrowBar pct={pct} style={styles.fill} />
        </View>
      </View>

      {/* 데이터 탭에 공개된 결과: 남들이 얼마나 봤는지 + 데이터 탭 화면으로 */}
      {s.hubViews !== null && (
        <Pressable
          style={styles.hubRow}
          onPress={() => router.push({ pathname: "/data/[id]", params: { id: String(s.id) } })}
          hitSlop={6}
        >
          <View style={styles.iconLine}>
            <AppIcon name={uiIcons.chart} size={16} color={colors.primary} />
            <Text style={styles.hubText}>데이터 탭 공개 중 · 열람 {s.hubViews}회</Text>
          </View>
          <Text style={styles.hubLink}>데이터 탭에서 보기 ›</Text>
        </Pressable>
      )}

      <View style={styles.bottom}>
        <Text style={list.sub}>
          {s.responseCount === 0 ? "아직 응답이 없어요" : `결과 공개 · ${VISIBILITY_LABELS[s.visibility]}`}
        </Text>
        {promote ? (
          <Pressable
            onPress={() => router.push({ pathname: "/community/new", params: { promo: String(s.id) } })}
            hitSlop={8}
          >
            <Text style={styles.link}>홍보하기 ›</Text>
          </Pressable>
        ) : s.responseCount > 0 ? (
          <Pressable
            style={({ pressed }) => [list.pill, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: "/survey/results", params: { id: String(s.id) } })}
            hitSlop={6}
          >
            <Text style={list.pillText}>결과 보기</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  progress: {
    gap: spacing.sm,
  },
  progressNum: {
    fontSize: fontSize.caption,
    fontWeight: "600",
    color: colors.cardTitle,
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  iconLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  hubRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  hubText: {
    flexShrink: 1,
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.text,
  },
  hubLink: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.primary,
  },
  bottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    minHeight: 28,
  },
  link: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
});
