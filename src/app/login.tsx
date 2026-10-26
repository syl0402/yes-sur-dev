// ys-010 로그인 · F-106 이메일 + 비밀번호 로그인
import { router, Stack } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import { colors, fontSize, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState("");

  const canLogin = email.trim().length > 0 && password.length > 0;

  const login = async () => {
    if (!canLogin || loggingIn) return;
    setLoggingIn(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setLoggingIn(false);
      setError(errorMessage(error));
      return;
    }
    // 가입을 마치지 않았거나 승인 전 단체면 useResumeSignup이 알맞은 화면으로 보낸다
    router.replace("/");
  };

  // TODO(임시): 비밀번호 찾기 · 로그인 다음 작업(ys-011 · F-107)에서 화면 연결 · docs/PROGRESS.md
  const findPassword = () => {
    showNotice("준비 중", "비밀번호 찾기는 곧 열려요.");
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "로그인" }} />

      <Text style={styles.heading}>로그인</Text>

      <Text style={styles.label}>이메일</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="가입한 이메일 주소"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
      />

      <Text style={styles.label}>비밀번호</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="비밀번호"
        secureTextEntry
        autoCapitalize="none"
        textContentType="password"
        onSubmitEditing={login}
      />

      {error !== "" && <Text style={styles.error}>{error}</Text>}

      <View style={styles.footer}>
        <PrimaryButton title="로그인" onPress={login} disabled={!canLogin} loading={loggingIn} />
      </View>

      <View style={styles.links}>
        <Pressable onPress={() => router.push("/signup/type")} hitSlop={8}>
          <Text style={styles.link}>회원가입</Text>
        </Pressable>
        <Text style={styles.divider}>|</Text>
        <Pressable onPress={findPassword} hitSlop={8}>
          <Text style={styles.link}>비밀번호를 잊으셨나요?</Text>
        </Pressable>
      </View>
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
    gap: spacing.sm,
  },
  heading: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  label: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: fontSize.body,
    color: colors.text,
  },
  error: {
    fontSize: fontSize.small,
    color: colors.danger,
  },
  footer: {
    marginTop: spacing.lg,
  },
  links: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  link: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  divider: {
    fontSize: fontSize.small,
    color: colors.border,
  },
});
