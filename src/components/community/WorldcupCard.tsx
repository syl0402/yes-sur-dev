import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import GrowBar from "@/components/ui/GrowBar";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { type WorldcupItem, roundLabel } from "@/lib/worldcup";

// 한 번 고르는 데 걸리는 대략 시간(초). "약 n분" 안내용
const SECONDS_PER_PICK = 4;

// 월드컵 카드 (2026-11-14 커뮤니티 시안 ① C안: 순위표 미리보기)
// 지금 1~3위 (우승 비율) + "내 1위는 다를까? 해보기". 참여가 적어 순위가 없으면 제목과 버튼만
// HOT 게시판에 든 월드컵이면 🔥 HOT 뱃지 (2026-11-03)
export default function WorldcupCard({ item: w, hot }: { item: WorldcupItem; hot?: boolean }) {
  const open = () => router.push({ pathname: "/community/worldcup/[id]", params: { id: String(w.id) } });
  const top = w.top ?? [];
  const minutes = Math.max(1, Math.round(((w.size - 1) * SECONDS_PER_PICK) / 60));

  return (
    <Card onPress={open}>
      <View style={styles.head}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>월드컵 {roundLabel(w.size)}</Text>
        </View>
        {hot && <Badge label="🔥 HOT" tone="hot" />}
        <Text style={styles.meta} numberOfLines={1}>
          옛썰 공식
        </Text>
      </View>
      <Text style={styles.title}>{w.title}</Text>

      {top.length > 0 && (
        <View style={styles.ranks}>
          {top.map((r, i) => (
            <View key={r.name} style={styles.rankRow}>
              <View style={[styles.rankDot, i === 0 && styles.rankDotFirst]}>
                <Text style={[styles.rankNum, i === 0 && styles.rankNumFirst]}>{i + 1}</Text>
              </View>
              <Text style={styles.rankName} numberOfLines={1}>
                {r.name}
              </Text>
              <View style={styles.track}>
                <GrowBar
                  pct={r.rate}
                  delay={i * 80}
                  style={[styles.fill, { backgroundColor: i === 0 ? colors.primary : colors.primaryMuted }]}
                />
              </View>
              <Text style={styles.rankPct}>{r.rate}%</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.footer}>
        {top.length > 0 ? "우승 비율 · " : ""}
        {w.plays}명 참여{w.comment_count ? ` · 댓글 ${w.comment_count}` : ""}
      </Text>
      <Button
        title={w.played ? "결과 보기" : top.length > 0 ? `내 1위는 다를까? 해보기 (약 ${minutes}분)` : `해보기 (약 ${minutes}분)`}
        variant="soft"
        onPress={open}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  // "월드컵 16강" (시안: 연노랑 바탕 + 갈색 글자)
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.warningSoft,
  },
  badgeText: {
    fontSize: fontSize.caption,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.warning,
  },
  meta: {
    flexShrink: 1,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  title: {
    fontSize: fontSize.body,
    lineHeight: 23,
    fontWeight: "800",
    color: colors.text,
  },
  ranks: {
    gap: spacing.sm,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rankDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  rankDotFirst: {
    backgroundColor: colors.accent,
  },
  rankNum: {
    fontSize: fontSize.caption,
    fontWeight: "800",
    color: colors.textMuted,
  },
  rankNumFirst: {
    color: colors.onAccent,
  },
  rankName: {
    width: 96,
    fontSize: fontSize.label,
    fontWeight: "600",
    color: colors.text,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
  },
  rankPct: {
    width: 38,
    textAlign: "right",
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.textStrong,
  },
  footer: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
});
