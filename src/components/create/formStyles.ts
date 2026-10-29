import { StyleSheet } from "react-native";

import { colors, fontSize, spacing } from "@/constants/theme";

// 설문 작성 단계 화면들이 같이 쓰는 입력칸·칩 모양
export const formStyles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.body,
    fontWeight: "600",
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
    borderRadius: 10,
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
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    fontSize: fontSize.small,
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.onPrimary,
    fontWeight: "600",
  },
});
