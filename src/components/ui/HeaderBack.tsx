// 화면 위쪽 왼쪽 ← 버튼 (2026-11-03). 기본 뒤로 가기 대신 확인 창 등을 먼저 띄워야 하는 화면에서 쓴다
import { Pressable } from "react-native";

import AppIcon from "@/components/AppIcon";
import { headerIcons } from "@/constants/icons";
import { colors } from "@/constants/theme";

// icon "close": 설문 응답처럼 그만두기(X) 버튼으로 쓸 때 (2026-11-12)
export default function HeaderBack({
  onPress,
  label = "나가기",
  icon = "back",
}: {
  onPress: () => void;
  label?: string;
  icon?: "back" | "close";
}) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={label}>
      <AppIcon name={headerIcons[icon]} size={24} color={colors.text} />
    </Pressable>
  );
}
