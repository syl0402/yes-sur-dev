// 화면 맨 아래 고정 버튼 줄 (흰 바탕 + 위 테두리). 아이폰 홈 막대·안드로이드 제스처 영역만큼 띄운다 (2026-10-31 디자인)
// note: 버튼 위 안내 (글자면 가운데 작은 회색 한 줄, 부품이면 그대로) (예: 설문 등록 ② "3문항 · 약 1분 · 1명당 15P", 2026-11-14)
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";

export default function BottomBar({ children, note }: { children: ReactNode; note?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      {typeof note === "string" ? <Text style={styles.note}>{note}</Text> : (note ?? null)}
      <View style={styles.row}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  note: {
    textAlign: "center",
    fontSize: fontSize.small,
    color: colors.iconStrong,
  },
});
