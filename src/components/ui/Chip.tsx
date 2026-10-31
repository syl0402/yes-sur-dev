// 알약 모양 선택 칩 (고르면 파란 바탕 + 흰 글자, 2026-10-31 디자인)
import { Pressable, StyleSheet } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
};

export default function Chip({ label, selected, onPress, disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={[styles.chip, selected && styles.selected, disabled && styles.disabled]}
      hitSlop={4}
    >
      <Text style={[styles.text, selected && styles.selectedText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  selected: {
    backgroundColor: colors.primary,
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.textMuted,
  },
  selectedText: {
    color: colors.onPrimary,
  },
});
