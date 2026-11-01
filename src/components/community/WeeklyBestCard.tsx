import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import { KIND_LABELS, type PostKind } from "@/lib/community";
import { supabase } from "@/lib/supabase";

// get_weekly_best 한 줄 (작성자 정보 없음)
type BestPost = { id: number; kind: PostKind; question: string; votes: number; comment_count: number };

// 주간 베스트: 최근 며칠 안에 올라온 글 중 투표+댓글이 많은 글 (기간·개수·최소 반응은 point_rules). 없으면 그리지 않는다
export default function WeeklyBestCard() {
  const [posts, setPosts] = useState<BestPost[]>([]);

  // 오류가 나면 조용히 숨긴다 (보조 정보라서)
  const load = useCallback(() => {
    supabase.rpc("get_weekly_best").then(({ data }) => setPosts((data as BestPost[] | null) ?? []));
  }, []);

  useFocusEffect(load);

  if (posts.length === 0) return null;

  return (
    <Card>
      <Text style={styles.title}>🔥 주간 베스트</Text>
      {posts.map((p, i) => (
        <Pressable
          key={p.id}
          style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && styles.pressed]}
          onPress={() => router.push({ pathname: "/community/[id]", params: { id: String(p.id) } })}
        >
          <Text style={[styles.rank, i === 0 && styles.rankFirst]}>{i + 1}</Text>
          <View style={styles.main}>
            <View style={styles.top}>
              <Badge label={KIND_LABELS[p.kind]} tone={p.kind === "promo" ? "accent" : "primary"} />
              <Text style={styles.meta}>
                투표 {p.votes} · 댓글 {p.comment_count}
              </Text>
            </View>
            <Text style={styles.question} numberOfLines={1}>
              {p.question}
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
