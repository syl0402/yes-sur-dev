// ys-003 첫 사용 안내 · F-106 (학생만, 3장. 가입 직후·업데이트 후 처음 한 번, 내 정보에서 다시 보기)
import { Stack, router, useLocalSearchParams } from "expo-router";
import { type ComponentRef, useEffect, useRef, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { markOnboardingSeen } from "@/lib/onboarding";
import { fetchRules } from "@/lib/rules";
import { supabase } from "@/lib/supabase";

// TODO(임시): 이모지 + 글자 · 디자인 시안(11/7)이 오면 그림으로 교체 · docs/PROGRESS.md
type Slide = { emoji: string; title: string; body: string };

export default function Onboarding() {
  // again=1: 내 정보에서 다시 보기 (끝나면 뒤로)
  const { again } = useLocalSearchParams<{ again?: string }>();
  const [page, setPage] = useState(0);
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
  const { width } = useWindowDimensions();
  const [r, setR] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchRules(["reward_1q", "reward_gte15", "daily_reward", "price_1q", "price_gte15", "cost_data_view"]).then(setR);
  }, []);

  const p = (key: string) => (r[key] !== undefined ? formatPoints(r[key]) : "");

  const slides: Slide[] = [
    {
      emoji: "📝",
      title: "답하고 포인트 모으기",
      body:
        `설문에 응답하면 길이에 따라 ${p("reward_1q")}~${p("reward_gte15")}를 받아요.\n` +
        `홈의 오늘의 질문은 매일 답하면 ${p("daily_reward")}씩, 연속 출석 보너스도 있어요.`,
    },
    {
      emoji: "📣",
      title: "내 설문 올리기",
      body:
        `모은 포인트로 설문을 올리면 학교 메일로 인증된 대학생들이 응답해요.\n` +
        `등록비는 응답 1명당 ${p("price_1q")}~${p("price_gte15")} × 목표 인원이에요.`,
    },
    {
      emoji: "📊",
      title: "결과 보고 같이 놀기",
      body:
        `데이터 탭에서 다른 설문 결과를 계열·학년·성별로 나눠 볼 수 있어요 (${p("cost_data_view")}, 첫 1회 무료).\n` +
        `커뮤니티에서는 밸런스 게임·투표·댓글, 이번 주 계열 대항전까지!`,
    },
  ];

  const finish = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) markOnboardingSeen(data.user.id);
    if (again === "1") {
      router.back();
      return;
    }
    router.replace("/");
  };

  const last = page === slides.length - 1;

  // [다음]: 옆 장으로 넘긴다 (스와이프와 같은 움직임)
  const next = () => pager.current?.scrollTo({ x: width * (page + 1), animated: true });

  // 스와이프가 멈추면 지금 장을 맞춘다 (점·버튼 글자)
  const onSwiped = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: again === "1" }} />

      <Pressable style={styles.skip} onPress={finish} hitSlop={12}>
        <Text style={styles.skipText}>{last ? "" : "건너뛰기"}</Text>
      </Pressable>

      {/* 한 장씩 옆으로 넘기기 */}
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onSwiped}
        style={styles.pager}
        contentContainerStyle={styles.pagerContent}
      >
        {slides.map((s) => (
          <View key={s.title} style={[styles.center, { width }]}>
            <Text style={styles.emoji}>{s.emoji}</Text>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
          ))}
        </View>
        <PrimaryButton title={last ? "시작하기" : "다음"} onPress={last ? finish : next} />
        <Pressable onPress={() => router.push("/points")} hitSlop={8}>
          <Text style={styles.link}>포인트 안내 자세히 보기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 장마다 화면 폭 전체를 써야 넘길 때 딱 맞으니, 좌우 여백은 각 부분에 따로 준다
  screen: {
    flex: 1,
    paddingTop: 64,
    backgroundColor: colors.background,
  },
  skip: {
    alignSelf: "flex-end",
    minHeight: 24,
    paddingHorizontal: spacing.lg,
  },
  skipText: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  pagerContent: {
    alignItems: "center",
  },
  pager: {
    flex: 1,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  emoji: {
    fontSize: 64,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  body: {
    fontSize: fontSize.body,
    color: colors.text,
    textAlign: "center",
    lineHeight: 24,
  },
  footer: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotOn: {
    width: 20,
    backgroundColor: colors.primary,
  },
  link: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    textAlign: "center",
    textDecorationLine: "underline",
  },
});
