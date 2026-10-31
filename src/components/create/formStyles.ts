import { StyleSheet } from "react-native";

import { colors, fontSize, radius, shadow, spacing } from "@/constants/theme";

// 설문 작성 단계 화면들이 같이 쓰는 입력칸·칩 모양
export const formStyles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  // 바깥 묶음: 흰 카드 (2026-10-31 디자인)
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  label: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  hint: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  error: {
    fontSize: fontSize.small,
    color: colors.danger,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.body,
    color: colors.text,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
