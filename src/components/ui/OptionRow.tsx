// 선택지 카드 (설문 응답·투표). 고르면 파란 테두리 + 연파랑 바탕 (2026-10-31 디자인)
// multiple: 여러 개 고르기면 네모 체크, 아니면 동그라미
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  multiple?: boolean;
  disabled?: boolean;
};

export default function OptionRow({ label, selected, onPress, multiple, disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.row, selected && styles.rowOn, disabled && styles.disabled]}
    >
      <View style={[multiple ? styles.box : styles.circle, selected && styles.markOn]}>
        {selected && (multiple ? <Text style={styles.check}>✓</Text> : <View style={styles.dot} />)}
      </View>
      <Text style={[styles.label, selected && styles.labelOn]}>{label}</Text>
    </Pressable>
  );
}

const MARK = 22;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  rowOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  disabled: {
    opacity: 0.4,
  },
  circle: {
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    borderWidth: 2,
    borderColor: colors.disabled,
    alignItems: "center",
    justifyContent: "center",
  },
  box: {
    width: MARK,
    height: MARK,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.disabled,
    alignItems: "center",
    justifyContent: "center",
  },
  markOn: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  check: {
    fontSize: fontSize.small,
    fontWeight: "800",
    color: colors.primary,
  },
  label: {
    flex: 1,
    fontSize: fontSize.body,
    color: colors.text,
  },
  labelOn: {
    fontWeight: "600",
    color: colors.primary,
  },
});
