import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";

type Props = {
  // 지금 단계 (1부터)
  current: number;
  total: number;
};

// 여러 화면으로 나뉜 흐름(가입 등)에서 지금 몇 단계인지 보여주는 막대
export default function StepIndicator({ current, total }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.bars}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.bar, i < current && styles.barDone]} />
        ))}
      </View>
      <Text style={styles.label}>
        {current} / {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  bars: {
    flex: 1,
    flexDirection: "row",
    gap: 4,
  },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  barDone: {
    backgroundColor: colors.primary,
  },
  label: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
});
