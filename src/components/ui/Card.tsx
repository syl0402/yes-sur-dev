// 흰 카드. onPress가 있으면 누를 수 있다 (2026-10-31 디자인)
// 2026-11-10: 모서리 20 · 여백 20으로 통일. 기본은 평평하게(얇은 회색 테두리, 그림자 없음)
// 그림자는 눌러서 들어가는 목록 카드에만 (설문·데이터 탭, 내 설문 → listCardStyles.card)
import type { ReactNode } from "react";
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import { colors, radius } from "@/constants/theme";

type Props = {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export default function Card({ children, onPress, style }: Props) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 20,
    gap: 12,
  },
  pressed: {
    opacity: 0.7,
  },
});
