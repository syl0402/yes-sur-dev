// ys-001 회원가입 · F-102 인증번호 확인
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import StepIndicator from "@/components/StepIndicator";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

// Supabase가 같은 이메일로 다시 보내는 것을 약 60초 동안 막는다 (Auth 설정)
const RESEND_WAIT_SECONDS = 60;
// 인증번호 자릿수는 Supabase 설정(Email OTP Length)을 따른다. 지금은 8자리
const MIN_CODE_LENGTH = 6;

export default function SignupVerify() {
  // mode=reset: 비밀번호 찾기(ys-011)에서 온 경우. 같은 인증번호 화면을 함께 쓴다
  const { email, agreed, type, mode } = useLocalSearchParams<{
    email: string;
    agreed?: string;
    type?: string;
    mode?: string;
  }>();
  const isReset = mode === "reset";

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

    // 비밀번호 찾기: 본인 확인이 끝났으니 새 비밀번호 화면으로 (뒤로 가기로 돌아오지 않게)
    if (isReset) {
      router.dismissAll();
      router.replace("/reset/password");
      return;
    }

    // 이미 가입을 마친 메일이면 (이메일 단계 확인을 지나친 경우를 위한 안전장치) 새로 가입시키지 않고 그대로 로그인 상태로 첫 화면에.
    const { data: profile } = await supabase.from("profiles").select("id").maybeSingle();
    if (profile) {
      showNotice("이미 가입된 계정이에요", "이 메일로 로그인했어요.", () => {
        router.dismissAll();
        router.replace("/");
      });
      return;
    }

    // 쌓인 가입 화면을 모두 걷어내고 회원정보 화면만 남긴다
    // → 인증이 끝난 뒤에는 뒤로 가기로 이메일·인증 화면에 돌아오지 않는다
    // 학생은 회원정보, 단체는 단체 정보 화면으로
    router.dismissAll();
    router.replace({
      pathname: type === "org" ? "/signup/org-info" : "/signup/profile",
      params: { agreed },
    });
  };

  const resend = async () => {
    setResending(true);
    setError("");
    setNotice("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      // 비밀번호 찾기에서는 새 계정을 만들지 않는다
      options: { shouldCreateUser: !isReset },
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
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: isReset ? "비밀번호 찾기" : "회원가입" }} />

      {!isReset && <StepIndicator current={4} total={5} />}
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
  // 내용이 짧아도 화면 끝까지 흰 배경
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
    borderRadius: radius.md,
    backgroundColor: colors.surface,
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
