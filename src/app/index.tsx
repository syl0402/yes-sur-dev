import { Link, router, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import { colors, fontSize, spacing } from "@/constants/theme";

// TODO(임시): 개발용 첫 화면 · 진짜 홈·로그인 화면을 만들면 교체 · docs/PROGRESS.md
export default function Index() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "옛썰" }} />

      <View style={styles.center}>
        <Text style={styles.title}>옛썰</Text>
        <Text style={styles.subtitle}>대학생끼리 설문을 주고받는 곳</Text>
      </View>

      <View style={styles.footer}>
        <PrimaryButton title="회원가입" onPress={() => router.push("/signup/terms")} />
        <Link href="/otp-test" style={styles.devLink}>
          OTP 테스트 (개발용)
        </Link>
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
  devLink: {
    textAlign: "center",
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
});
