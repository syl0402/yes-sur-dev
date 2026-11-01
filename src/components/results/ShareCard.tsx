// 결과 요약 공유 이미지 (인스타 스토리·카톡). 화면 밖에 그려 두고 captureRef로 이미지로 만든다 (2026-11-01)
// 큰 숫자 하나(가장 눈에 띄는 결과) + 핵심 인사이트 2~3개(질문 이름 포함) + 출처. 개인 정보·5명 미만 그룹 없음
import type { ComponentRef, Ref } from "react";
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import type { Insight } from "@/lib/resultSummary";

// 가장 눈에 띄는 결과: 하나 고르기 문항 중 1위 비율이 가장 높은 것
export type ShareHero = { pct: number; option: string; question: string };

type Props = {
  ref?: Ref<ComponentRef<typeof View>>;
  title: string;
  hero: ShareHero | null;
  insights: Insight[];
  total: number;
  period: string;
};

export const SHARE_CARD_WIDTH = 360;

export default function ShareCard({ ref, title, hero, insights, total, period }: Props) {
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={styles.band}>
        <Text style={styles.brand}>옛썰</Text>
        <Text style={styles.brandSub}>대학생 설문 결과 요약</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>

        {hero && (
          <View style={styles.hero}>
            <Text style={styles.heroPct}>{hero.pct}%</Text>
            <View style={styles.heroMain}>
              <Text style={styles.heroOption}>‘{hero.option}’</Text>
              <Text style={styles.heroQuestion} numberOfLines={2}>
                {hero.question}
              </Text>
            </View>
          </View>
        )}

        {insights.length > 0 && (
          <View style={styles.list}>
            {insights.map((it, i) => (
              <View key={i} style={[styles.item, i > 0 && styles.divider]}>
                <Text style={styles.emoji}>{it.emoji}</Text>
                <View style={styles.itemMain}>
                  <Text style={styles.itemTitle}>{it.title}</Text>
                  <Text style={styles.itemDetail} numberOfLines={2}>
                    {it.detail}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.source}>
          옛썰 · 대학생 {total}명 응답 · {period}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  band: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
  },
  brand: {
    fontSize: fontSize.title,
    fontWeight: "800",
    color: colors.onPrimary,
  },
  brandSub: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.accent,
  },
  body: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    fontSize: fontSize.subtitle,
    fontWeight: "800",
    color: colors.text,
    lineHeight: 26,
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  heroPct: {
    fontSize: 44,
    fontWeight: "800",
    color: colors.primary,
  },
  heroMain: {
    flex: 1,
    gap: 2,
  },
  heroOption: {
    fontSize: fontSize.body,
    fontWeight: "800",
    color: colors.text,
  },
  heroQuestion: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    lineHeight: 18,
  },
  list: {
    paddingHorizontal: spacing.xs,
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  emoji: {
    fontSize: fontSize.body,
    lineHeight: 22,
  },
  itemMain: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 20,
  },
  itemDetail: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    lineHeight: 17,
  },
  source: {
    marginTop: spacing.xs,
    fontSize: fontSize.caption,
    color: colors.textSubtle,
    textAlign: "center",
  },
});
