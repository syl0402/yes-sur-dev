// [✓ 익명] 체크 (글 만들기 · 댓글 입력칸, 2026-11-03). 끄면 닉네임으로 보인다
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

export default function AnonToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      style={styles.row}
      onPress={() => onChange(!value)}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
    >
      <View style={[styles.box, value && styles.boxOn]}>{value && <Text style={styles.check}>✓</Text>}</View>
      <Text style={[styles.label, value && styles.labelOn]}>익명</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  box: {
    width: 18,
    height: 18,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.textSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  check: {
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 14,
    color: colors.onPrimary,
  },
  label: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.textMuted,
  },
  labelOn: {
    color: colors.primary,
  },
});
