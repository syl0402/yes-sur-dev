// 화면 맨 아래 고정 버튼 줄 (흰 바탕 + 위 테두리). 아이폰 홈 막대·안드로이드 제스처 영역만큼 띄운다 (2026-10-31 디자인)
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "@/constants/theme";

export default function BottomBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>{children}</View>;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
