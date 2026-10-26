// ys-001 회원가입 · F-102 인증번호 확인
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import { colors, fontSize, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

// Supabase가 같은 이메일로 다시 보내는 것을 약 60초 동안 막는다 (Auth 설정)
const RESEND_WAIT_SECONDS = 60;
// 인증번호 자릿수는 Supabase 설정(Email OTP Length)을 따른다. 지금은 8자리
const MIN_CODE_LENGTH = 6;

export default function SignupVerify() {
  const { email, agreed } = useLocalSearchParams<{ email: string; agreed?: string }>();

  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(RESEND_WAIT_SECONDS);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // 다시 보내기까지 남은 시간 줄이기
  useEffect(() => {
    if (waitSeconds <= 0) return;
    const timer = setTimeout(() => setWaitSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [waitSeconds]);

  const verify = async () => {
    if (verifying) return;
    setVerifying(true);
    setError("");
    setNotice("");

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });

    if (error) {
      setVerifying(false);
      setError(errorMessage(error));
      return;
    }
    // 쌓인 가입 화면을 모두 걷어내고 회원정보 화면만 남긴다
    // → 인증이 끝난 뒤에는 뒤로 가기로 이메일·인증 화면에 돌아오지 않는다
    router.dismissAll();
    router.replace({ pathname: "/signup/profile", params: { agreed } });
  };

  const resend = async () => {
    setResending(true);
    setError("");
    setNotice("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    setResending(false);
    if (error) {
      setError(errorMessage(error));
      return;
    }
    setNotice("인증번호를 다시 보냈어요.");
    setWaitSeconds(RESEND_WAIT_SECONDS);
  };

  const canResend = waitSeconds <= 0 && !resending;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "회원가입" }} />

      <Text style={styles.heading}>인증번호를 입력해 주세요</Text>
      <Text style={styles.guide}>
        {email}(으)로 보낸 인증번호를 입력해 주세요. 메일이 안 보이면 스팸함도 확인해 주세요.
      </Text>

      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ""))}
        placeholder="인증번호"
        keyboardType="number-pad"
        maxLength={10}
        autoFocus
      />

      {error !== "" && <Text style={styles.error}>{error}</Text>}
      {notice !== "" && <Text style={styles.notice}>{notice}</Text>}

      <View style={styles.footer}>
        <PrimaryButton
          title="확인"
          onPress={verify}
          disabled={code.length < MIN_CODE_LENGTH}
          loading={verifying}
        />
      </View>

      <Pressable onPress={resend} disabled={!canResend} style={styles.resend}>
        <Text style={[styles.resendText, !canResend && styles.resendDisabled]}>
          {waitSeconds > 0 ? `${waitSeconds}초 후 다시 보낼 수 있어요` : "인증번호 다시 보내기"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  heading: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
  },
  guide: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: fontSize.title,
    letterSpacing: 4,
    color: colors.text,
  },
  error: {
    fontSize: fontSize.small,
    color: colors.danger,
  },
  notice: {
    fontSize: fontSize.small,
    color: colors.primary,
  },
  footer: {
    marginTop: spacing.sm,
  },
  resend: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  resendText: {
    fontSize: fontSize.small,
    color: colors.primary,
    textDecorationLine: "underline",
  },
  resendDisabled: {
    color: colors.textMuted,
    textDecorationLine: "none",
  },
});
