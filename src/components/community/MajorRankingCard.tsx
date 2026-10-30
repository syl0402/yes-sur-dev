import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fontSize, spacing } from "@/constants/theme";
import type { MajorRanking } from "@/lib/community";
import { supabase } from "@/lib/supabase";

const MEDALS = ["🥇", "🥈", "🥉"];

// 이번 주 계열 대항전: 1~3위 + 내 계열 순위 (투표·오늘의 질문·글·댓글 수). 아직 참여가 없으면 그리지 않는다
export default function MajorRankingCard() {
  const [data, setData] = useState<MajorRanking | null>(null);

  // 오류가 나면 조용히 숨긴다 (보조 정보라서)
  const load = useCallback(() => {
    supabase.rpc("get_major_ranking").then(({ data: d }) => setData((d as MajorRanking | null) ?? null));
  }, []);

  useFocusEffect(load);

  if (!data || data.ranking.length === 0) return null;

  const top = data.ranking.slice(0, 3);
  const myInTop = top.some((r) => r.major === data.my_major);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🏆 이번 주 계열 대항전</Text>
      <View style={styles.rows}>
        {top.map((r, i) => (
          <Text key={r.major} style={[styles.row, r.major === data.my_major && styles.mine]}>
            {MEDALS[Math.min(r.rank, 3) - 1] ?? MEDALS[i]} {r.major} · {r.count}
          </Text>
        ))}
      </View>
      <Text style={styles.hint}>
        {data.my_major && data.my_rank && !myInTop
          ? `내 계열 ${data.my_major}는 ${data.my_rank}위예요. 투표·댓글로 순위를 올려 보세요!`
          : "투표·댓글·오늘의 질문에 참여하면 내 계열 점수가 올라가요."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.border,
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  rows: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  row: {
    fontSize: fontSize.small,
    color: colors.text,
  },
  mine: {
    fontWeight: "700",
    color: colors.primary,
  },
  hint: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
});
