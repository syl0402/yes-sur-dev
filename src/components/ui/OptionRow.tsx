// 선택지 카드 (설문 응답). 2026-11-12 설문 흐름 시안 respond/Answer:
// 글자는 왼쪽, 표시는 오른쪽. 고르면 파란 테두리(2) + 연파랑 바탕 + 파란 체크 동그라미
// multiple: 여러 개 고르기면 둥근 네모, 아니면 동그라미
import { Pressable, StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import { Text } from "@/components/ui/Text";
import { uiIcons } from "@/constants/icons";
import { colors, fontSize, radius } from "@/constants/theme";

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
      accessibilityRole={multiple ? "checkbox" : "radio"}
      accessibilityState={{ checked: selected, disabled }}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowOn,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, selected && styles.labelOn]}>{label}</Text>
      {selected ? (
        <View style={[styles.mark, styles.markOn, multiple && styles.markSquare]}>
          <AppIcon name={uiIcons.check} size={15} color={colors.onPrimary} />
        </View>
      ) : (
        <View style={[styles.mark, multiple && styles.markSquare]} />
      )}
    </Pressable>
  );
}

const MARK = 22;

const styles = StyleSheet.create({
  // 테두리 1 → 고르면 2. 두꺼워진 만큼 안쪽 여백을 줄여 글자가 움직이지 않게
  row: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 17,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  rowOn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primaryFaint,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: "500",
    lineHeight: 22,
    color: colors.text,
  },
  labelOn: {
    fontWeight: "700",
    color: colors.primaryStrong,
  },
  mark: {
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  markSquare: {
    borderRadius: 6,
  },
  markOn: {
    width: 24,
    height: 24,
    borderWidth: 0,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
});
