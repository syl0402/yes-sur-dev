// 커뮤니티 배너 1장: 오늘의 질문 (매일 바뀌어서 이미지 대신 화면에서 그린다, 2026-11-10)
// 다른 이미지 배너(CC 좋다 vs 별로다)처럼 "A VS B"를 크게 + 반짝이·원 장식 + 마스코트가 둥실 떠 있는 움직임
// 움직임은 React Native 기본 Animated (새 라이브러리 없음)
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import { Text } from "@/components/ui/Text";
import { homeIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";

const MASCOT = require("../../../assets/images/mascot-cheer.png");

export type TodayDaily = {
  question: string;
  option_a: string;
  option_b: string;
  my_choice: "a" | "b" | null;
  reward: number;
};

type Props = { daily: TodayDaily; width: number; height: number; onPress: () => void };

export default function DailyBanner({ daily, width, height, onPress }: Props) {
  // 0 → 1 → 0 반복 (마스코트 위아래 · 반짝이 깜빡임)
  const [float] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  const mascotY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const sparkle = float.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const answered = daily.my_choice !== null;

  return (
    <Pressable onPress={onPress} style={[styles.banner, { width, height }]} accessibilityLabel={`오늘의 질문: ${daily.question}`}>
      {/* 배경 장식: 왼쪽 위 큰 원 · 오른쪽 아래 행성 · 반짝이 */}
      <View style={styles.bubble} />
      <View style={styles.planet} />
      <Animated.View style={[styles.sparkleA, { opacity: sparkle }]}>
        <AppIcon name={homeIcons.sparkle} size={22} color={colors.accent} />
      </Animated.View>
      <Animated.View style={[styles.sparkleB, { opacity: sparkle }]}>
        <AppIcon name={homeIcons.star} size={12} color={colors.onPrimary} />
      </Animated.View>
      <Animated.View style={[styles.mascotWrap, { transform: [{ translateY: mascotY }] }]}>
        <Image source={MASCOT} style={styles.mascot} contentFit="contain" accessible={false} />
      </Animated.View>

      <View style={styles.content}>
        <Text style={styles.eyebrow}>오늘의 질문</Text>
        <Text style={styles.question} numberOfLines={2}>
          {daily.question}
        </Text>
        {/* A VS B (답했으면 내 선택에 ✓) */}
        <View style={styles.versus}>
          <Option label={daily.option_a} mine={daily.my_choice === "a"} />
          <View style={styles.vs}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          <Option label={daily.option_b} mine={daily.my_choice === "b"} />
        </View>
        <Text style={styles.cta}>
          {answered ? "결과 보기 ›" : daily.reward > 0 ? `답하고 +${formatPoints(daily.reward)} 받기 ›` : "답하러 가기 ›"}
        </Text>
      </View>
    </Pressable>
  );
}

function Option({ label, mine }: { label: string; mine: boolean }) {
  return (
    <View style={[styles.option, mine && styles.optionMine]}>
      <Text style={[styles.optionText, mine && styles.optionTextMine]} numberOfLines={1}>
        {mine ? `✓ ${label}` : label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    overflow: "hidden",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
  },
  bubble: {
    position: "absolute",
    left: -60,
    top: -70,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.onPrimarySoft,
  },
  // 홈 포인트 카드와 같은 흰색 38% 원
  planet: {
    position: "absolute",
    right: -70,
    bottom: -110,
    width: 240,
    height: 220,
    borderRadius: 120,
    backgroundColor: colors.onPrimaryPlanet,
  },
  sparkleA: {
    position: "absolute",
    right: 30,
    top: 28,
  },
  sparkleB: {
    position: "absolute",
    right: 150,
    top: 44,
  },
  mascotWrap: {
    position: "absolute",
    right: -18,
    bottom: 12,
  },
  // 원본 그림 비율 1264 × 848
  mascot: {
    width: 170,
    height: 114,
  },
  // 마스코트와 겹치지 않게 왼쪽 64%
  content: {
    width: "64%",
    gap: spacing.sm,
  },
  eyebrow: {
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    overflow: "hidden",
    backgroundColor: colors.accent,
    fontSize: fontSize.caption,
    fontWeight: "700",
    color: colors.onAccent,
  },
  question: {
    fontSize: fontSize.subtitle + 2,
    lineHeight: 28,
    fontWeight: "800",
    color: colors.onPrimary,
  },
  versus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  option: {
    flexShrink: 1,
    paddingVertical: 6,
    paddingHorizontal: spacing.md - spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  optionMine: {
    backgroundColor: colors.accent,
  },
  optionText: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.primary,
  },
  optionTextMine: {
    color: colors.onAccent,
  },
  vs: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.heading,
  },
  vsText: {
    fontSize: fontSize.caption - 1,
    fontWeight: "800",
    color: colors.accent,
  },
  cta: {
    marginTop: 2,
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.onPrimary,
  },
});
