// 진행 막대 (예: 응답 진행률, 현재 문항). value는 0~1 (2026-10-31 디자인)
import { StyleSheet, View } from "react-native";

import { colors, radius } from "@/constants/theme";

export default function ProgressBar({ value, height = 8 }: { value: number; height?: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={[styles.track, { height }]}>
      <View style={[styles.fill, { width: `${pct}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
});
