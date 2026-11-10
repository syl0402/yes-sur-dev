// 커뮤니티 배너: 트렌드 리포트 예고 (2026-11-10 결정 A: 날짜 없이 "곧 공개" + 누르면 짧은 소개)
// TODO(임시): 코드로 그린 임시 배너 · 디자인팀 배너 이미지가 오면 교체 · 디자인팀 시안 없음
// 진한 남색 바탕 + 막대그래프가 자라났다 줄었다 하는 움직임 (React Native 기본 Animated)
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { showNotice } from "@/lib/notice";

const CHARACTER = require("../../../assets/images/characters/study.png");

// 막대 4개: 최대 높이 비율 (마지막이 가장 높게 = 늘어나는 추세)
const BARS = [0.45, 0.65, 0.55, 0.9];
const BAR_MAX = 64;

// 누르면 뜨는 소개 (기획 문서 "인사이트와 트렌드 리포트" 요약)
const INTRO =
  "· 주간 인사이트: 매주 인기 투표 결과를 카드 뉴스로 요약해 무료로 보여 드려요.\n" +
  "· 월간 대학생 트렌드 리포트: 대학생의 관심사와 소비를 분석해 데이터 탭에 올려요.";

export default function ReportTeaserBanner({ width, height }: { width: number; height: number }) {
  // 0 → 1 → 0 반복: 막대가 자라났다 살짝 줄어든다
  const [grow] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(grow, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.delay(600),
        Animated.timing(grow, { toValue: 0.55, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [grow]);

  return (
    <Pressable
      onPress={() => showNotice("트렌드 리포트, 곧 공개해요", INTRO)}
      style={[styles.banner, { width, height }]}
      accessibilityLabel="대학생 트렌드 리포트 곧 공개"
    >
      <View style={styles.glow} />

      {/* 오른쪽: 막대그래프 + 캐릭터 */}
      <View style={styles.chart}>
        {BARS.map((h, i) => (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              i === BARS.length - 1 && styles.barTop,
              {
                height: BAR_MAX * h,
                // 아래를 기준으로 자라나게: 높이의 절반만큼 내렸다가 scaleY와 함께 올라온다
                transform: [
                  { translateY: grow.interpolate({ inputRange: [0, 1], outputRange: [(BAR_MAX * h) / 2, 0] }) },
                  { scaleY: grow.interpolate({ inputRange: [0, 1], outputRange: [0.001, 1] }) },
                ],
              },
            ]}
          />
        ))}
      </View>
      <Image source={CHARACTER} style={styles.character} contentFit="contain" accessible={false} />

      <View style={styles.content}>
        <Text style={styles.eyebrow}>COMING SOON</Text>
        <Text style={styles.title}>대학생 트렌드 리포트</Text>
        <Text style={styles.sub}>주간 인사이트 · 월간 리포트{"\n"}곧 공개돼요</Text>
        <Text style={styles.cta}>무엇이 담기나요? ›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    overflow: "hidden",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.heading,
  },
  // 오른쪽 위 은은한 파란 원
  glow: {
    position: "absolute",
    right: -40,
    top: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.primary,
    opacity: 0.45,
  },
  chart: {
    position: "absolute",
    right: 36,
    bottom: 36,
    height: BAR_MAX,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  bar: {
    width: 16,
    borderTopLeftRadius: radius.sm / 2,
    borderTopRightRadius: radius.sm / 2,
    backgroundColor: colors.primaryMuted,
  },
  // 마지막 막대만 라임 (가장 높은 = 트렌드)
  barTop: {
    backgroundColor: colors.accent,
  },
  // 학사모 캐릭터 (원본 240 × 218)
  character: {
    position: "absolute",
    right: 120,
    bottom: 26,
    width: 70,
    height: 64,
  },
  content: {
    width: "56%",
    gap: spacing.sm,
  },
  eyebrow: {
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    overflow: "hidden",
    backgroundColor: colors.accent,
    fontSize: fontSize.caption - 1,
    fontWeight: "800",
    color: colors.onAccent,
  },
  title: {
    fontSize: fontSize.subtitle + 2,
    lineHeight: 28,
    fontWeight: "800",
    color: colors.onPrimary,
  },
  sub: {
    fontSize: fontSize.small,
    lineHeight: 19,
    color: colors.primaryMuted,
  },
  cta: {
    marginTop: 2,
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.onPrimary,
  },
});
