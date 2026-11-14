// 화면 위쪽 왼쪽 뒤로 버튼 (2026-11-03). 기본 뒤로 가기 대신 확인 창 등을 먼저 띄워야 하는 화면에서 쓴다
// 2026-11-14 온보딩 시안: 모양을 '<' 하나로 통일 + 흰 원형 버튼. 아이폰은 제목줄이 버튼을 유리 원으로 감싸서 아이콘만
// (안드로이드·웹은 기본 뒤로 버튼(←) 대신 이 버튼을 쓴다: app/_layout.tsx)
import { Platform, Pressable, StyleSheet } from "react-native";

import AppIcon from "@/components/AppIcon";
import { headerIcons } from "@/constants/icons";
import { colors, shadow } from "@/constants/theme";

const SIZE = 40;

// icon "close": 설문 응답처럼 그만두기(X) 버튼으로 쓸 때 (2026-11-12)
export default function HeaderBack({
  onPress,
  label = "뒤로",
  icon = "back",
}: {
  onPress: () => void;
  label?: string;
  icon?: "back" | "close";
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [Platform.OS !== "ios" && styles.round, pressed && styles.pressed]}
    >
      <AppIcon name={headerIcons[icon]} size={24} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  round: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.onPrimary,
    ...shadow.card,
  },
  pressed: {
    opacity: 0.7,
  },
});
