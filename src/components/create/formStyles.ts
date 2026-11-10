import { StyleSheet } from "react-native";

import { colors, fontSize, radius, spacing } from "@/constants/theme";

// 설문 작성 단계 화면들이 같이 쓰는 입력칸·칩 모양
export const formStyles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  // 바깥 묶음: 흰 카드. 2026-11-10 앱 카드(Card)와 같게: 평평한 얇은 테두리 · 모서리 20 · 여백 20
  card: {
    gap: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  hint: {
    fontSize: fontSize.caption,
    lineHeight: 17,
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
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    fontSize: 15,
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
