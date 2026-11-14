// ys-003 사용 안내 · F-106 (2026-11-14 온보딩 시안 ⑧: 4장 · 장마다 움직이는 그림 · 장마다 들어오는 방식이 다름)
// from=signup: 가입 직후 (위 오른쪽 "건너뛰기", 마지막 "시작하기" → 환영 화면)
// again=1: 마이 › 사용 안내 다시 보기 (위 오른쪽 X, 마지막 "확인" → 돌아감)
// 그 밖(업데이트 후 처음 한 번 등): 끝나면 홈으로
import { Stack, router, useLocalSearchParams } from "expo-router";
import { type ReactNode, useEffect, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp, SlideInRight, ZoomIn, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CommunityArt, MySurveyArt, PointsArt, ResultsArt } from "@/components/onboarding/GuideSlides";
import PrimaryButton from "@/components/PrimaryButton";
import AppIcon from "@/components/AppIcon";
import { Text } from "@/components/ui/Text";
import { guideIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { markOnboardingSeen } from "@/lib/onboarding";
import { fetchRules } from "@/lib/rules";
import { supabase } from "@/lib/supabase";

type Slide = { title: string; body: string; art: ReactNode };

// 장마다 들어오는 방식: 1 아래에서 올라옴 · 2 오른쪽에서 밀려옴 · 3 작게 시작해 커짐 · 4 살짝 떠오름
const ENTER = [FadeInDown.duration(450), SlideInRight.duration(450), ZoomIn.duration(450), FadeInUp.duration(500)];

export default function Onboarding() {
  const { again, from } = useLocalSearchParams<{ again?: string; from?: string }>();
  const isAgain = again === "1";
  const isSignup = from === "signup";
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const [page, setPage] = useState(0);
  const [r, setR] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchRules(["reward_1q", "reward_gte15", "daily_reward"]).then(setR);
  }, []);

  const p = (key: string) => (r[key] !== undefined ? formatPoints(r[key]) : "");

  const slides: Slide[] = [
    {
      title: "답하면\n포인트가 쌓여요",
      body: `설문 하나에 ${p("reward_1q")}~${p("reward_gte15")}, 오늘의 질문은 매일 ${p("daily_reward")}예요`,
      art: <PointsArt />,
    },
    { title: "모은 포인트로\n내 설문을 올려요", body: "학교 메일로 인증된 대학생들이 답해요", art: <MySurveyArt /> },
    {
      title: "다른 설문 결과도\n볼 수 있어요",
      body: "데이터 탭에서 계열·학년별로 나눠 보고, 첫 결과 보기는 무료예요",
      art: <ResultsArt />,
    },
    { title: "커뮤니티에서\n같이 놀아요", body: "밸런스 게임, 골라 줘, 월드컵까지", art: <CommunityArt /> },
  ];
  const last = page === slides.length - 1;

  const finish = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) markOnboardingSeen(data.user.id);
    if (isAgain) {
      router.back();
      return;
    }
    // 가입 직후: 환영 화면 (가입 선물 · 웰컴 미션 1일차)
    router.replace(isSignup ? "/signup/done" : "/");
  };

  const next = () => (last ? finish() : setPage(page + 1));
  // 그림 칸 높이 (시안 약 420, 작은 폰은 화면의 52%까지)
  const artH = Math.min(420, height * 0.52);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm, paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: isAgain }} />

      {/* 위: n / 4 · 오른쪽 건너뛰기(가입 직후) 또는 X(다시 보기) */}
      <View style={styles.top}>
        <Text style={styles.count}>
          {page + 1} / {slides.length}
        </Text>
        {isAgain ? (
          <Pressable onPress={finish} hitSlop={12} accessibilityLabel="닫기">
            <AppIcon name={guideIcons.close} size={26} color={colors.text} />
          </Pressable>
        ) : !last ? (
          <Pressable onPress={finish} hitSlop={12}>
            <Text style={styles.skip}>건너뛰기</Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      {/* 장이 바뀔 때마다 그림이 새로 그려지며 움직임이 처음부터 */}
      <Animated.View key={page} entering={reduce ? undefined : ENTER[page]} style={styles.slide}>
        <View style={[styles.art, { height: artH }]}>{slides[page].art}</View>
        <Animated.View entering={reduce ? undefined : FadeIn.delay(200).duration(400)} style={styles.texts}>
          <Text style={styles.title}>{slides[page].title}</Text>
          <Text style={styles.body}>{slides[page].body}</Text>
        </Animated.View>
      </Animated.View>

      <View style={styles.footer}>
        {/* 점: 지금 장은 길게 */}
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
          ))}
        </View>
        <PrimaryButton title={last ? (isAgain ? "확인" : "시작하기") : "다음"} onPress={next} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
  },
  top: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  count: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.iconStrong,
  },
  skip: {
    fontSize: fontSize.label,
    fontWeight: "600",
    color: colors.iconStrong,
  },
  slide: {
    flex: 1,
  },
  art: {
    overflow: "visible",
  },
  texts: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: 26,
    lineHeight: 35,
    fontWeight: "800",
    color: colors.text,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.iconStrong,
  },
  footer: {
    gap: spacing.lg,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  dotOn: {
    width: 22,
    backgroundColor: colors.primary,
  },
});
