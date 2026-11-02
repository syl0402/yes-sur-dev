import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import Card from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import type { SchoolRanking } from "@/lib/community";
import { supabase } from "@/lib/supabase";

const MEDALS = ["🥇", "🥈", "🥉"];

// 이번 주 학교 대항전: 1~3위 + 내 학교 순위 (투표·오늘의 질문·글·댓글·월드컵 횟수 합계, 2026-11-02 계열 대항전 대신)
// 활동한 학생이 적은 학교는 서버가 빼서 보낸다. 순위가 없으면 그리지 않는다
export default function SchoolRankingCard() {
  const [data, setData] = useState<SchoolRanking | null>(null);

  // 오류가 나면 조용히 숨긴다 (보조 정보라서)
  const load = useCallback(() => {
    supabase.rpc("get_school_ranking").then(({ data: d }) => setData((d as SchoolRanking | null) ?? null));
  }, []);

  useFocusEffect(load);

  if (!data || data.ranking.length === 0) return null;

  const top = data.ranking.slice(0, 3);
  const myInTop = top.some((r) => r.school === data.my_school);

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>🏆 이번 주 학교 대항전</Text>
      {top.map((r, i) => (
        <View key={r.school} style={[styles.row, i > 0 && styles.divider]}>
          <Text style={styles.medal}>{MEDALS[Math.min(r.rank, 3) - 1] ?? MEDALS[i]}</Text>
          <Text style={[styles.school, r.school === data.my_school && styles.mine]} numberOfLines={1}>
            {r.school}
          </Text>
          <Text style={[styles.count, r.school === data.my_school && styles.mine]}>{r.count.toLocaleString("ko-KR")}</Text>
        </View>
      ))}
      <Text style={styles.hint}>
        {data.my_school && data.my_rank && !myInTop
          ? `우리 학교 ${data.my_school}는 ${data.my_rank}위예요. 투표·댓글로 점수를 올려 보세요!`
          : data.my_school && !data.my_rank
            ? "우리 학교는 아직 순위에 없어요. 친구를 초대해서 같이 참여해 보세요!"
            : "투표·댓글·오늘의 질문·월드컵에 참여하면 우리 학교 점수가 올라가요."}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: colors.primarySoft,
  },
  title: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  medal: {
    fontSize: fontSize.body,
  },
  school: {
    flex: 1,
    fontSize: fontSize.body,
    color: colors.text,
  },
  count: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.textMuted,
  },
  mine: {
    fontWeight: "800",
    color: colors.primary,
  },
  hint: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
});
