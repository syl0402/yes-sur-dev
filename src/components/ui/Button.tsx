// 버튼 3종 (2026-10-31 디자인)
// primary: 파란 바탕 (화면의 주 행동) · soft: 연파랑 바탕 + 파란 글자 · outline: 흰 바탕 + 테두리
import { ActivityIndicator, Pressable, type StyleProp, StyleSheet, type ViewStyle } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

export type ButtonVariant = "primary" | "soft" | "outline";

type Props = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  // small: 카드 안 작은 버튼
  small?: boolean;
  disabled?: boolean;
  // true면 돌아가는 표시를 보여주고 누르기를 막는다 (연타 방지)
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

const textColor: Record<ButtonVariant, string> = {
  primary: colors.onPrimary,
  soft: colors.primary,
  outline: colors.text,
};

export default function Button({ title, onPress, variant = "primary", small, disabled, loading, style }: Props) {
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        small && styles.small,
        inactive && (variant === "primary" ? styles.inactivePrimary : styles.inactive),
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor[variant]} />
      ) : (
        <Text style={[styles.title, small && styles.smallTitle, { color: textColor[variant] }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.primary,
  },
  soft: {
    backgroundColor: colors.primarySoft,
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  small: {
    minHeight: 40,
    borderRadius: radius.sm,
  },
  inactivePrimary: {
    backgroundColor: colors.disabled,
  },
  inactive: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.8,
  },
  title: {
    fontSize: fontSize.body,
    fontWeight: "700",
  },
  smallTitle: {
    fontSize: fontSize.small,
  },
});
