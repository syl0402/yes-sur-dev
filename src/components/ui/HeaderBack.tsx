// 화면 위쪽 왼쪽 ← 버튼 (2026-11-03). 기본 뒤로 가기 대신 확인 창 등을 먼저 띄워야 하는 화면에서 쓴다
import { Pressable } from "react-native";

import AppIcon from "@/components/AppIcon";
import { headerIcons } from "@/constants/icons";
import { colors } from "@/constants/theme";

export default function HeaderBack({ onPress, label = "나가기" }: { onPress: () => void; label?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={label}>
      <AppIcon name={headerIcons.back} size={24} color={colors.text} />
    </Pressable>
  );
}
