// 작은 체크 한 줄 (동의 문구 등). OptionRow보다 가볍게: 테두리 상자 없이 네모 체크 + 글자 (2026-11-07)
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

export default function CheckRow({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.row} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[styles.box, checked && styles.boxOn]}>{checked && <Text style={styles.check}>✓</Text>}</View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const SIZE = 20;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  box: {
    width: SIZE,
    height: SIZE,
    marginTop: 1,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  boxOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  check: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.surface,
  },
  label: {
    flex: 1,
    fontSize: fontSize.small,
    lineHeight: 20,
    color: colors.text,
  },
});
