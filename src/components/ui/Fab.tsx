// 오른쪽 아래 둥근 버튼 (예: 커뮤니티 글 만들기). 부모 화면(View) 안에서 위치를 고정한다 (2026-11-03)
import { Pressable, StyleSheet } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, shadow, spacing } from "@/constants/theme";

export default function Fab({ onPress, label = "+", accessibilityLabel }: { onPress: () => void; label?: string; accessibilityLabel: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const SIZE = 56;

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    ...shadow.card,
    shadowOpacity: 0.2,
    elevation: 6,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: fontSize.hero,
    fontWeight: "600",
    lineHeight: 34,
    color: colors.onPrimary,
  },
});
