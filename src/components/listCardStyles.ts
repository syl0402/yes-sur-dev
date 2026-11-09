// 설문 탭·데이터 탭 목록 카드가 함께 쓰는 모양 (2026-11-09 피그마 카드 디자인 116:329)
// 위: 주최·남은 시간 / 제목 / #태그  →  아래: 왼쪽(표시 알약 · 시간 정보) + 오른쪽(포인트 알약)
import { StyleSheet } from "react-native";

import { colors, fontSize, radius, shadow } from "@/constants/theme";

export const listCardStyles = StyleSheet.create({
  // 흰 카드 · 모서리 20 · 테두리 없이 그림자. 앱 카드 중 그림자는 이 목록 카드만 (2026-11-10)
  card: {
    padding: 20,
    gap: 12,
    borderRadius: radius.xl,
    borderColor: "transparent",
    ...shadow.listCard,
  },
  // 내 설문: 파란 테두리 + 아주 옅은 파랑 바탕
  mineCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  head: {
    gap: 4,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  host: {
    flexShrink: 1,
    fontSize: fontSize.caption,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.primary,
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
    alignItems: "flex-start",
    gap: 8,
  },
  bottomLeft: {
    flex: 1,
    gap: 12,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  metaIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  // 오른쪽 파란 알약 (포인트)
  pill: {
    minWidth: 73,
    height: 29,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  pillText: {
    fontSize: fontSize.caption,
    lineHeight: 20,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  // 내 설문: 포인트 대신 모인 응답 수
  progressText: {
    fontSize: fontSize.caption,
    lineHeight: 20,
    fontWeight: "700",
    color: colors.primary,
  },
});
