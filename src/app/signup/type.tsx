// ys-001 회원가입 · F-101 가입 유형 선택 (학생 / 단체)
// 2026-11-14 온보딩 시안 ②: 카드를 골라 두고 [다음]으로 (자동으로 넘어가지 않음) · 고른 카드 파란 테두리 + 체크 · 학생에 "가입하면 500P"
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInUp, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppIcon from "@/components/AppIcon";
import PrimaryButton from "@/components/PrimaryButton";
import StepIndicator from "@/components/StepIndicator";
import { Text } from "@/components/ui/Text";
import { uiIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { fetchWelcomePoints } from "@/lib/rules";

type SignupType = "student" | "org";

const OPTIONS: { value: SignupType; title: string; description: string }[] = [
  {
    value: "student",
    title: "학생",
    description: "학교 메일로 가입해요. 설문에 응답하고 포인트를 모을 수 있어요.",
  },
  {
    value: "org",
    title: "단체",
    description: "학생회·동아리·센터·연구실·기업. 승인을 받으면 단체 이름으로 설문을 올릴 수 있어요.",
  },
];

// 학생 가입 단계 수 (회원 종류 · 약관 · 학교 메일 · 인증번호 · 비밀번호·닉네임 · 나에 대해)
const STUDENT_STEPS = 6;

export default function SignupTypeScreen() {
  // resume=1: 인증만 하고 가입을 마치지 않은 사람이 이어서 하는 경우 (useResumeSignup)
  const { resume } = useLocalSearchParams<{ resume?: string }>();
  const isResume = resume === "1";
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [type, setType] = useState<SignupType | null>(null);
  const [welcome, setWelcome] = useState<number | null>(null);

  useEffect(() => {
    fetchWelcomePoints().then(setWelcome);
  }, []);

  const next = () => {
    if (!type) return;
    router.push({ pathname: "/signup/terms", params: { type, resume } });
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
        <Stack.Screen options={{ title: "회원가입" }} />

        {isResume && <Text style={styles.notice}>가입을 이어서 진행할게요.</Text>}
        <StepIndicator current={1} total={STUDENT_STEPS} />
        <Animated.View entering={reduce ? undefined : FadeInUp.duration(400)}>
          <Text style={styles.heading}>어떤 회원으로 가입할까요?</Text>
        </Animated.View>

        {OPTIONS.map((option) => {
          const on = type === option.value;
          return (
            <Pressable
              key={option.value}
              style={({ pressed }) => [styles.card, on && styles.cardOn, pressed && styles.pressed]}
              onPress={() => setType(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <View style={styles.cardMain}>
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle}>{option.title}</Text>
                  {option.value === "student" && welcome !== null && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>가입하면 {formatPoints(welcome)}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardDescription}>{option.description}</Text>
              </View>
              <View style={[styles.check, on && styles.checkOn]}>
                {on && <AppIcon name={uiIcons.check} size={16} color={colors.onPrimary} />}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <PrimaryButton title="다음" onPress={next} disabled={!type} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    gap: 12,
  },
  notice: {
    fontSize: fontSize.small,
    color: colors.primary,
  },
  heading: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    fontSize: 25,
    lineHeight: 34,
    fontWeight: "800",
    color: colors.text,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  // 고른 카드: 파란 테두리 + 아주 옅은 파랑
  cardOn: {
    borderWidth: 2,
    padding: 21,
    borderColor: colors.primary,
    backgroundColor: colors.primaryFaint,
  },
  pressed: {
    opacity: 0.85,
  },
  cardMain: {
    flex: 1,
    gap: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  tagText: {
    fontSize: fontSize.caption,
    fontWeight: "800",
    color: colors.onAccentSoft,
  },
  cardDescription: {
    fontSize: fontSize.label,
    lineHeight: 21,
    color: colors.iconStrong,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  footer: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});
