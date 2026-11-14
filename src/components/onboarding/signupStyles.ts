// 가입 화면들이 같이 쓰는 모양 (2026-11-14 온보딩 시안: 제목 25 · 상자형 입력 칸 · 고르기 칸)
import { StyleSheet } from "react-native";

import { colors, fontSize, radius, spacing } from "@/constants/theme";

export const signupStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heading: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    fontSize: 25,
    lineHeight: 34,
    fontWeight: "800",
    color: colors.text,
  },
  label: {
    marginTop: spacing.md,
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.iconStrong,
  },
  // 상자형 입력 칸 (흰 바탕 · 테두리)
  input: {
    height: 54,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.onPrimary,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.body,
    color: colors.text,
  },
  hint: {
    fontSize: fontSize.small,
    lineHeight: 19,
    color: colors.iconStrong,
  },
  error: {
    fontSize: fontSize.small,
    color: colors.danger,
  },
  // 고르기 칸 (과정 · 성별 · 연도)
  optionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  option: {
    flex: 1,
    height: 52,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.onPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  optionOn: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primaryFaint,
  },
  optionText: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.text,
  },
  optionTextOn: {
    color: colors.primary,
    fontWeight: "700",
  },
  // 아래 고정 버튼 자리
  footer: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});
