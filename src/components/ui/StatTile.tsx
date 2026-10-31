// 숫자 카드 (예: 운영 중인 설문 3 · 이번 달 응답 286). 나란히 놓으면 칸을 나눠 쓴다 (2026-10-31 디자인)
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

export default function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  label: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  value: {
    fontSize: fontSize.title,
    fontWeight: "800",
    color: colors.primary,
  },
});
