import { Redirect, router, Stack } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import { colors, fontSize, spacing } from "@/constants/theme";
import { useSession } from "@/hooks/useSession";

// 로그인 전 첫 화면. 로그인돼 있으면 홈 탭으로 보낸다
// (가입을 마치지 않았거나 승인 전 단체면 useResumeSignup이 알맞은 화면으로 다시 보낸다)
// TODO(임시): 첫 화면 디자인(로고·소개 문구) · 디자인 단계에서 교체 · docs/PROGRESS.md
export default function Index() {
  const session = useSession();

  // 로그인 상태 확인 중
  if (session === undefined) return null;
  if (session) return <Redirect href="/home" />;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "옛썰" }} />

      <View style={styles.center}>
        <Text style={styles.title}>옛썰</Text>
        <Text style={styles.subtitle}>대학생끼리 설문을 주고받는 곳</Text>
      </View>

      <View style={styles.footer}>
        <PrimaryButton title="로그인" onPress={() => router.push("/login")} />
        <Pressable onPress={() => router.push("/signup/type")} style={styles.textButton}>
          <Text style={styles.textButtonLabel}>
            처음이신가요? <Text style={styles.textButtonStrong}>회원가입</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSize.hero,
    fontWeight: "800",
    color: colors.primary,
  },
  subtitle: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  footer: {
    gap: spacing.md,
    alignItems: "stretch",
  },
  textButton: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  textButtonLabel: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  textButtonStrong: {
    color: colors.primary,
    fontWeight: "600",
  },
});
