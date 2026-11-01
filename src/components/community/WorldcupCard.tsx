import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { type WorldcupItem, roundLabel } from "@/lib/worldcup";

// 월드컵 카드: item을 주면 그 월드컵(목록 한 줄), 안 주면 가장 최근 월드컵을 직접 불러온다(커뮤니티 '전체' 위쪽). 없으면 그리지 않는다
export default function WorldcupCard({ item }: { item?: WorldcupItem }) {
  const [latest, setLatest] = useState<WorldcupItem | null>(null);

  // 오류가 나면 조용히 숨긴다 (보조 정보라서)
  const load = useCallback(() => {
    if (item) return;
    supabase.rpc("get_worldcups").then(({ data }) => setLatest(((data as WorldcupItem[] | null) ?? [])[0] ?? null));
  }, [item]);

  useFocusEffect(load);

  const w = item ?? latest;
  if (!w) return null;

  const open = () => router.push({ pathname: "/community/worldcup/[id]", params: { id: String(w.id) } });

  return (
    <Card onPress={open}>
      <View style={styles.top}>
        <Text style={styles.eyebrow}>🏆 월드컵</Text>
        <Badge label={roundLabel(w.size)} tone="accent" />
      </View>
      <Text style={styles.title}>{w.title}</Text>
      <View style={styles.bottom}>
        <Text style={styles.meta}>{w.plays}명 참여</Text>
        <Button title={w.played ? "결과 보기" : "시작하기"} variant={w.played ? "soft" : "primary"} small onPress={open} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.primary,
  },
  title: {
    fontSize: fontSize.subtitle,
    fontWeight: "700",
    color: colors.text,
  },
  bottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  meta: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
});
