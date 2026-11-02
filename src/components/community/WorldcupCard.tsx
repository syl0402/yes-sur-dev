import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import { type WorldcupItem, roundLabel } from "@/lib/worldcup";

// 월드컵 목록 한 줄. HOT 게시판에 든 월드컵이면 🔥 HOT 뱃지 (2026-11-03)
export default function WorldcupCard({ item: w, hot }: { item: WorldcupItem; hot?: boolean }) {
  const open = () => router.push({ pathname: "/community/worldcup/[id]", params: { id: String(w.id) } });

  return (
    <Card onPress={open}>
      <View style={styles.top}>
        <Text style={styles.eyebrow}>🏆 월드컵</Text>
        {hot && <Badge label="🔥 HOT" tone="hot" />}
        <View style={styles.spacer} />
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
    gap: spacing.sm,
  },
  spacer: {
    flex: 1,
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
