// ys-000 첫 화면 · F-101 (로그인 전. 2026-11-14 온보딩 시안 ①: 파란 아치 · 캐릭터 둥실 · 말풍선 대화 · 시작하기 / 로그인)
// 로그인돼 있으면 홈 탭으로 보낸다 (가입을 마치지 않았거나 승인 전 단체면 useResumeSignup이 알맞은 화면으로 다시 보낸다)
import { Image } from "expo-image";
import { Redirect, router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChatTeaser from "@/components/onboarding/ChatTeaser";
import PrimaryButton from "@/components/PrimaryButton";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import { useSession } from "@/hooks/useSession";
import { formatPoints } from "@/lib/format";
import { fetchWelcomePoints } from "@/lib/rules";

const CHEER = require("../../assets/images/characters/cheer.png");
// 캐릭터 그림 비율 (410 × 305)
const CHEER_RATIO = 305 / 410;
// 파란 아치 높이 (시안 590, 작은 폰에서는 화면의 66%까지만)
const ARCH = 590;

export default function Index() {
  const session = useSession();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const reduce = useReducedMotion();
  // 가입 선물 (point_rules welcome, 로그인 전이라 get_welcome_points로)
  const [welcome, setWelcome] = useState<number | null>(null);
  const float = useSharedValue(0);

  useEffect(() => {
    fetchWelcomePoints().then(setWelcome);
  }, []);

  // 캐릭터가 위아래로 천천히 둥실 (3.4초)
  useEffect(() => {
    if (reduce) return;
    const ease = Easing.inOut(Easing.sin);
    float.value = withRepeat(
      withSequence(withTiming(-8, { duration: 1700, easing: ease }), withTiming(0, { duration: 1700, easing: ease })),
      -1,
    );
  }, [reduce, float]);
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: float.value }] }));

  // 로그인 상태 확인 중
  if (session === undefined) return null;
  if (session) return <Redirect href="/home" />;

  const archH = Math.min(ARCH, screenH * 0.66);
  const enter = (delay: number) => (reduce ? undefined : FadeInUp.delay(delay).duration(500));

  return (
    <View style={[styles.screen, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* 위쪽 파란 아치 */}
      <View style={[styles.arch, { height: archH, paddingTop: insets.top + 52 }]}>
        <View style={styles.ring} />
        <View style={styles.dot} />

        <Animated.View entering={enter(100)}>
          <Text style={styles.title}>
            대학생들의 진짜 생각,{"\n"}
            <Text style={styles.titleLime}>옛썰</Text>에서 물어봐
          </Text>
        </Animated.View>
        <Animated.View entering={enter(400)}>
          <Text style={styles.subtitle}>대학생끼리 설문을 주고받는 곳</Text>
        </Animated.View>

        <Animated.View style={[styles.mascot, floatStyle]}>
          <Image source={CHEER} style={styles.mascotImg} contentFit="contain" accessibilityLabel="옛썰 캐릭터" />
        </Animated.View>
        <View style={styles.chat}>
          <ChatTeaser />
        </View>
      </View>

      <View style={styles.spacer} />

      <Animated.View entering={enter(400)} style={styles.footer}>
        {welcome !== null && (
          <Text style={styles.gift}>
            가입하면 <Text style={styles.giftStrong}>{formatPoints(welcome)}</Text>를 바로 드려요
          </Text>
        )}
        <PrimaryButton title="시작하기" onPress={() => router.push("/signup/type")} />
        <Pressable onPress={() => router.push("/login")} style={styles.login} hitSlop={8}>
          <Text style={styles.loginText}>
            이미 계정이 있어요 · <Text style={styles.loginStrong}>로그인</Text>
          </Text>
        </Pressable>
        {/* TODO(임시): 비공개 테스트 표시 · 정식 출시 때 지우기 · 2026-11-14 테스트 시작 */}
        <Text style={styles.beta}>지금은 비공개 테스트 중이에요</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // 아래가 둥근 파란 아치
  arch: {
    paddingHorizontal: 28,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 120,
    borderBottomRightRadius: 120,
    overflow: "hidden",
  },
  // 반투명 흰 원 장식 2개
  ring: {
    position: "absolute",
    left: -60,
    top: 70,
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 24,
    borderColor: colors.onPrimarySoft,
  },
  dot: {
    position: "absolute",
    right: -40,
    top: 250,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.onPrimarySoft,
  },
  title: {
    fontSize: 30,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: colors.onPrimary,
  },
  titleLime: {
    color: colors.accent,
  },
  subtitle: {
    marginTop: 10,
    fontSize: fontSize.body,
    color: colors.primarySoft,
  },
  mascot: {
    position: "absolute",
    right: 0,
    bottom: 26,
  },
  mascotImg: {
    width: 180,
    height: 180 * CHEER_RATIO,
  },
  chat: {
    position: "absolute",
    left: 24,
    bottom: 78,
  },
  spacer: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    gap: 6,
  },
  gift: {
    marginBottom: 6,
    textAlign: "center",
    fontSize: fontSize.small,
    color: colors.iconStrong,
  },
  giftStrong: {
    fontWeight: "700",
    color: colors.onAccentSoft,
  },
  login: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  loginText: {
    fontSize: fontSize.label,
    color: colors.iconStrong,
  },
  beta: {
    textAlign: "center",
    fontSize: fontSize.caption,
    color: colors.textSubtle,
  },
  loginStrong: {
    fontWeight: "700",
    color: colors.primary,
  },
});
