// ys-011 계정 찾기 · F-107 비밀번호 찾기: 이메일 입력
import { router, Stack } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import { colors, fontSize, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ResetEmail() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // 가입되지 않은 것으로 확인된 메일 (입력을 바꾸면 안내가 사라진다)
  const [unknownEmail, setUnknownEmail] = useState("");

  const trimmed = email.trim();
  const isValid = EMAIL_PATTERN.test(trimmed);
  const notRegistered = unknownEmail !== "" && unknownEmail === trimmed;

  const sendCode = async () => {
    if (!isValid || sending) return;
    setSending(true);
    setError("");

    // 가입되지 않은 메일이면 바로 알려준다 (2026-10-27 결정)
    const { data: registered } = await supabase.rpc("is_email_registered", { p_email: trimmed });
    if (registered !== true) {
      setSending(false);
      setUnknownEmail(trimmed);
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      // 비밀번호 찾기에서는 새 계정을 만들지 않는다
      options: { shouldCreateUser: false },
    });

    setSending(false);
    if (error) {
      setError(errorMessage(error));
      return;
    }
    router.push({ pathname: "/signup/verify", params: { email: trimmed, mode: "reset" } });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "비밀번호 찾기" }} />

      <Text style={styles.heading}>가입한 메일을 입력해 주세요</Text>
      <Text style={styles.guide}>
        인증번호로 본인 확인을 한 뒤 새 비밀번호를 정할 수 있어요. 학생은 학교 메일, 단체는 가입한 공식
        메일이에요.
      </Text>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="가입한 이메일 주소"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
      />
      {email.length > 0 && !isValid && (
        <Text style={styles.error}>메일 주소 형식을 확인해 주세요.</Text>
      )}

      {error !== "" && <Text style={styles.error}>{error}</Text>}

      {notRegistered ? (
        <View style={styles.box}>
          <Text style={styles.boxText}>가입되지 않은 메일이에요.</Text>
          <PrimaryButton
            title="회원가입하기"
            onPress={() => {
              router.dismissAll();
              router.push("/signup/type");
            }}
          />
        </View>
      ) : (
        <View style={styles.footer}>
          <PrimaryButton
            title="인증번호 보내기"
            onPress={sendCode}
            disabled={!isValid}
            loading={sending}
          />
        </View>
      )}
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
  },
  guide: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    marginBottom: spacing.sm,
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
  box: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  boxText: {
    fontSize: fontSize.body,
    color: colors.danger,
    textAlign: "center",
  },
});
