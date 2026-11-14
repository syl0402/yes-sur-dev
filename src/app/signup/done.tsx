// ys-002 가입 환영 · F-105 (2026-11-14 온보딩 시안 ⑨: 사용 안내 4장 다음)
// 꽃가루 · 캐릭터 + "+500P" 튀어나옴 · "닉네임님, 반가워요! 가입 선물로 nP 드렸어요" · 웰컴 미션 1일차 카드 · [첫 미션 하러 가기] → 웰컴 미션 판
// 금액은 서버 기준 (가입 선물 point_rules welcome · 미션 보상은 get_my_missions)
import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeInUp,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PrimaryButton from "@/components/PrimaryButton";
import Confetti from "@/components/ui/Confetti";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, shadow, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { fetchMyMissions, type Mission } from "@/lib/missions";
import { fetchWelcomePoints } from "@/lib/rules";
import { supabase } from "@/lib/supabase";

const CHEER = require("../../../assets/images/characters/cheer.png");
// 캐릭터 그림 비율 (410 × 305)
const CHEER_RATIO = 305 / 410;

export default function SignupDone() {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [nickname, setNickname] = useState("");
  const [welcome, setWelcome] = useState<number | null>(null);
  // 웰컴 미션 1일차 (미션 기간이 아니면 null)
  const [first, setFirst] = useState<Mission | null>(null);
  const float = useSharedValue(0);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("nickname")
      .maybeSingle()
      .then(({ data }) => setNickname(data?.nickname ?? ""));
    fetchWelcomePoints().then(setWelcome);
    fetchMyMissions().then((m) => setFirst(m?.missions.find((x) => x.day === 1) ?? null));
  }, []);

  // 캐릭터 둥실
  useEffect(() => {
    if (reduce) return;
    const ease = Easing.inOut(Easing.sin);
    float.value = withRepeat(withSequence(withTiming(-8, { duration: 1700, easing: ease }), withTiming(0, { duration: 1700, easing: ease })), -1);
  }, [reduce, float]);
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: float.value }] }));

  const enter = (delay: number) => (reduce ? undefined : FadeInUp.delay(delay).duration(450));

  // 홈을 먼저 깔고 그 위에 웰컴 미션 판 (14일 길, 뒤로 가면 홈). 미션 기간이 아니면 홈만
  const start = () => {
    router.replace("/home");
    if (first) router.push("/missions");
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xl, paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <Confetti height={340} />

      <View style={styles.center}>
        <View style={styles.hero}>
          <View style={styles.circle} />
          <Animated.View style={[styles.mascot, floatStyle]}>
            <Image source={CHEER} style={styles.mascotImg} contentFit="contain" accessibilityLabel="옛썰 캐릭터" />
          </Animated.View>
          {welcome !== null && (
            <Animated.View entering={reduce ? undefined : ZoomIn.delay(500).springify()} style={styles.gift}>
              <Text style={styles.giftText}>+{formatPoints(welcome)}</Text>
            </Animated.View>
          )}
        </View>

        <Animated.View entering={enter(300)}>
          <Text style={styles.title}>
            {nickname ? `${nickname}님, ` : ""}반가워요!{"\n"}
            {welcome !== null ? `가입 선물로 ${formatPoints(welcome)} 드렸어요` : "가입을 마쳤어요"}
          </Text>
        </Animated.View>
        {first && (
          <Animated.View entering={enter(450)}>
            <Text style={styles.sub}>14일 웰컴 미션으로 하나씩 해 볼까요?</Text>
          </Animated.View>
        )}
      </View>

      {/* 웰컴 미션 1일차 */}
      {first && (
        <Animated.View entering={enter(600)} style={styles.mission}>
          <View style={styles.day}>
            <Text style={styles.dayText}>1일{"\n"}차</Text>
          </View>
          <View style={styles.missionMain}>
            <Text style={styles.missionTitle}>{first.title}</Text>
            <Text style={styles.missionSub}>완료하면 +{formatPoints(first.reward)}</Text>
          </View>
        </Animated.View>
      )}

      <View style={styles.spacer} />
      {/* TODO(임시): 비공개 테스트 안내 · 정식 출시 때 지우기 · 2026-11-14 테스트 시작 */}
      <View style={styles.beta}>
        <Text style={styles.betaText}>
          지금은 테스트 기간이라 불편한 점이 있을 수 있어요. 오류나 바라는 점은{" "}
          <Text
            style={styles.betaLink}
            onPress={() => router.push({ pathname: "/feedback", params: { from: "가입 환영" } })}
          >
            의견 보내기
          </Text>
          로 알려 주세요!
        </Text>
      </View>
      <PrimaryButton title={first ? "첫 미션 하러 가기" : "시작하기"} onPress={start} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
  },
  center: {
    alignItems: "center",
  },
  hero: {
    width: 220,
    height: 200,
  },
  circle: {
    position: "absolute",
    left: 10,
    top: 10,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.primaryFaint,
  },
  mascot: {
    position: "absolute",
    left: 20,
    top: 40,
  },
  mascotImg: {
    width: 180,
    height: 180 * CHEER_RATIO,
  },
  // "+500P" (라임 알약 · 흰 테두리)
  gift: {
    position: "absolute",
    right: -24,
    top: 0,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: colors.onPrimary,
    backgroundColor: colors.accent,
    ...shadow.card,
  },
  giftText: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.onAccent,
  },
  title: {
    marginTop: 30,
    fontSize: 26,
    lineHeight: 36,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  sub: {
    marginTop: 10,
    fontSize: 15,
    color: colors.iconStrong,
    textAlign: "center",
  },
  mission: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 26,
    paddingVertical: spacing.md,
    paddingHorizontal: 18,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  day: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  dayText: {
    fontSize: fontSize.small,
    lineHeight: 15,
    fontWeight: "800",
    color: colors.onAccentSoft,
    textAlign: "center",
  },
  missionMain: {
    flex: 1,
    gap: 3,
  },
  missionTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  missionSub: {
    fontSize: fontSize.small,
    color: colors.iconStrong,
  },
  spacer: {
    flex: 1,
  },
  beta: {
    marginBottom: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
  },
  betaText: {
    fontSize: fontSize.small,
    lineHeight: 19,
    color: colors.iconStrong,
    textAlign: "center",
  },
  betaLink: {
    fontWeight: "700",
    color: colors.primary,
    textDecorationLine: "underline",
  },
});
