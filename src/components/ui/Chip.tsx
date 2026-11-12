// 알약 모양 선택 칩 (고르면 파란 바탕 + 흰 글자, 2026-10-31 디자인)
// outline: 테두리 칩 (설문 등록 태그처럼 카테고리 칩과 구분할 때, 2026-11-12). 고르면 연파랑 + 파란 테두리
// icon: 글자 앞에 붙는 작은 아이콘 (2026-11-10, 스크랩 칩) · 크기·색은 2026-11-10 피그마 140:2136 값
import { Pressable, StyleSheet } from "react-native";

import AppIcon from "@/components/AppIcon";
import { Text } from "@/components/ui/Text";
import type { IconName } from "@/constants/icons";
import { colors, fontSize, radius } from "@/constants/theme";

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  icon?: IconName;
  outline?: boolean;
};

export default function Chip({ label, selected, onPress, disabled, icon, outline }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={[
        styles.chip,
        outline ? [styles.outline, selected && styles.outlineSelected] : selected && styles.selected,
        disabled && styles.disabled,
      ]}
      hitSlop={4}
    >
      {icon && <AppIcon name={icon} size={16} color={selected ? colors.onPrimary : colors.textMuted} />}
      <Text
        style={[styles.text, outline ? [styles.outlineText, selected && styles.outlineSelectedText] : selected && styles.selectedText]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
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
    fontSize: fontSize.caption,
    fontWeight: "500",
    color: colors.textMuted,
  },
  selectedText: {
    color: colors.onPrimary,
  },
  outline: {
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  outlineSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  outlineText: {
    color: colors.textStrong,
  },
  outlineSelectedText: {
    fontWeight: "600",
    color: colors.primaryStrong,
  },
});
