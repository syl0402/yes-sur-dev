// 목록 카드가 함께 쓰는 모양 (설문 탭·데이터 탭·홈 카드·마이 탭)
// 2026-11-10 피그마 140:178 · 140:2215 · 145:3042 값:
// 위 표시 알약 · 남은 시간(오른쪽) / 제목 / #태그(파랑)  →  아래: 왼쪽(시간 정보 / 올린 곳) + 오른쪽(아이콘 알약)
import { StyleSheet } from "react-native";

import { colors, fontSize, radius, shadow, spacing } from "@/constants/theme";

export const listCardStyles = StyleSheet.create({
  // 탭 목록 카드: Natural 30 바탕 · 모서리 16 · 여백 16 · 테두리 없이 옅은 그림자
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderColor: "transparent",
    backgroundColor: colors.surface,
    ...shadow.listCard,
  },
  // 홈 카드: 그림자 대신 얇은 테두리 (피그마 145:3042 · 145:3585)
  borderCard: {
    borderColor: colors.border,
    boxShadow: [],
  },
  // 내 설문: 살짝 다른 바탕 (피그마 143:2465, 표시는 "내 설문" 진한 알약)
  mineCard: {
    backgroundColor: colors.surfaceSubtle,
  },
  head: {
    gap: spacing.xs,
  },
  // 표시 알약들 + 오른쪽 남은 시간·마감일
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  // 남은 시간·마감일 (Natural 500)
  topRight: {
    fontSize: fontSize.caption,
    lineHeight: 20,
    fontWeight: "500",
    color: colors.textSubtle,
  },
  sub: {
    fontSize: fontSize.caption,
    lineHeight: 20,
    fontWeight: "500",
    color: colors.cardSub,
  },
  title: {
    fontSize: fontSize.body,
    lineHeight: 24,
    fontWeight: "700",
    color: colors.cardTitle,
  },
  bottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  badges: {
    flexShrink: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  // 아래 왼쪽: 시간 정보 줄 + 올린 곳 줄
  footLeft: {
    flex: 1,
    gap: 2,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: spacing.xs,
  },
  metaIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  // 오른쪽 알약 (포인트 · 열람): Blue 500 · 높이 33 · 모서리 10
  pill: {
    flexDirection: "row",
    gap: spacing.xs,
    minWidth: 64,
    height: 33,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  pillText: {
    fontSize: fontSize.caption,
    lineHeight: 20,
    fontWeight: "700",
    color: colors.onPrimaryText,
  },
  // 이미 본 결과: 회색 알약 (Natural 200 + Natural 600)
  pillMuted: {
    backgroundColor: colors.border,
  },
  pillMutedText: {
    color: colors.textMuted,
  },
  // 내 설문: 포인트 대신 모인 응답 수
  progressText: {
    fontSize: fontSize.caption,
    lineHeight: 20,
    fontWeight: "700",
    color: colors.primary,
  },
});
