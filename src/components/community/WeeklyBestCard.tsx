import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import { type HotItem, hotHref, KIND_LABELS } from "@/lib/community";

// HOT 게시판 TOP: 최근 며칠 안에 반응(투표·참여 + 댓글)이 많은 글·월드컵 (기간·개수·최소 반응은 point_rules, 2026-11-03)
// 목록은 커뮤니티 화면이 불러와서 넘겨준다. 없으면 그리지 않는다
export default function WeeklyBestCard({ items }: { items: HotItem[] }) {
  if (items.length === 0) return null;

  return (
    <Card>
      <Text style={styles.title}>🔥 HOT</Text>
      {items.map((h, i) => (
        <Pressable
          key={`${h.type}-${h.id}`}
          style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && styles.pressed]}
          onPress={() => router.push(hotHref(h))}
        >
          <Text style={[styles.rank, i === 0 && styles.rankFirst]}>{i + 1}</Text>
          <View style={styles.main}>
            <View style={styles.top}>
              <Badge
                label={h.kind === "worldcup" ? "월드컵" : KIND_LABELS[h.kind]}
                tone={h.kind === "promo" || h.kind === "worldcup" ? "accent" : "primary"}
              />
              <Text style={styles.meta}>
                {h.type === "worldcup" ? "참여" : "투표"} {h.votes} · 댓글 {h.comment_count}
              </Text>
            </View>
            <Text style={styles.question} numberOfLines={1}>
              {h.question}
            </Text>
          </View>
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pressed: {
    opacity: 0.6,
  },
  rank: {
    width: 20,
    fontSize: fontSize.subtitle,
    fontWeight: "800",
    color: colors.textSubtle,
    textAlign: "center",
  },
  rankFirst: {
    color: colors.primary,
  },
  main: {
    flex: 1,
    gap: spacing.xs,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  meta: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  question: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.text,
  },
});
