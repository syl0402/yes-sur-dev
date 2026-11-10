// 오른쪽 아래 둥근 버튼 (설문 등록·커뮤니티 글 만들기). 부모 화면(View) 안에서 위치를 고정한다 (2026-11-03)
// 2026-11-10 피그마: "+" 글자 → 연필 아이콘
import { Pressable, StyleSheet } from "react-native";

import AppIcon from "@/components/AppIcon";
import { type IconName, uiIcons } from "@/constants/icons";
import { colors, shadow, spacing } from "@/constants/theme";

export default function Fab({
  onPress,
  icon = uiIcons.write,
  accessibilityLabel,
}: {
  onPress: () => void;
  icon?: IconName;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
    >
      <AppIcon name={icon} size={26} color={colors.onPrimary} />
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
});
