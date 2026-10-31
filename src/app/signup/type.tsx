// ys-001 회원가입 · F-101 가입 유형 선택 (학생 / 단체)
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet } from "react-native";

import StepIndicator from "@/components/StepIndicator";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

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
    description:
      "학생회·동아리·센터·연구실·기업. 승인을 받으면 단체 이름으로 설문을 올릴 수 있어요.",
  },
];

export default function SignupTypeScreen() {
  // resume=1: 인증만 하고 가입을 마치지 않은 사람이 이어서 하는 경우 (useResumeSignup)
  const { resume } = useLocalSearchParams<{ resume?: string }>();
  const isResume = resume === "1";

  const choose = (type: SignupType) => {
    router.push({ pathname: "/signup/terms", params: { type, resume } });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Stack.Screen options={{ title: "회원가입" }} />

      {isResume && <Text style={styles.notice}>가입을 이어서 진행할게요.</Text>}
      <StepIndicator current={1} total={5} />
      <Text style={styles.heading}>어떤 회원으로 가입할까요?</Text>

      {OPTIONS.map((option) => (
        <Pressable key={option.value} style={styles.card} onPress={() => choose(option.value)}>
          <Text style={styles.cardTitle}>{option.title}</Text>
          <Text style={styles.cardDescription}>{option.description}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  notice: {
    fontSize: fontSize.small,
    color: colors.primary,
  },
  heading: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  card: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
  },
  cardDescription: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
});
