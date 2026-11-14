// ys-001 회원가입 · F-102 인증번호 확인
// 2026-11-14 온보딩 시안 ⑤: 숫자 칸(한 칸씩 자동 이동) · 남은 시간 · 다시 보내기 · 스팸함 안내 상자
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import CodeBoxes from "@/components/onboarding/CodeBoxes";
import PrimaryButton from "@/components/PrimaryButton";
import StepIndicator from "@/components/StepIndicator";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

// Supabase가 같은 이메일로 다시 보내는 것을 약 60초 동안 막는다 (Auth 설정)
const RESEND_WAIT_SECONDS = 60;
// 인증번호 자릿수: Supabase 설정(Auth → Email OTP Length)과 같아야 한다. 지금 8자리 (설정을 6으로 바꾸면 여기도 6)
const CODE_LENGTH = 8;
// 인증번호 유효 시간(초): Supabase 설정(Email OTP Expiration)과 같게. 남은 시간 표시용
const CODE_VALID_SECONDS = 300;

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
  // 인증번호 남은 시간 (다시 보내면 처음부터)
  const [validSeconds, setValidSeconds] = useState(CODE_VALID_SECONDS);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // 다시 보내기까지 · 인증번호 남은 시간 줄이기 (1초마다)
  useEffect(() => {
    if (waitSeconds <= 0 && validSeconds <= 0) return;
    const timer = setTimeout(() => {
      setWaitSeconds((s) => Math.max(0, s - 1));
      setValidSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [waitSeconds, validSeconds]);

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
    setCode("");
    setWaitSeconds(RESEND_WAIT_SECONDS);
    setValidSeconds(CODE_VALID_SECONDS);
  };

  const canResend = waitSeconds <= 0 && !resending;
  const left = `${String(Math.floor(validSeconds / 60)).padStart(2, "0")}:${String(validSeconds % 60).padStart(2, "0")}`;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: isReset ? "비밀번호 찾기" : "회원가입" }} />

      {!isReset && <StepIndicator current={4} total={type === "org" ? 5 : 6} />}
      <Text style={styles.heading}>메일로 온 번호를 넣어 주세요</Text>
      <Text style={styles.guide}>
        <Text style={styles.guideStrong}>{email}</Text> 로 {CODE_LENGTH}자리 번호를 보냈어요.
      </Text>

      <CodeBoxes value={code} onChange={setCode} length={CODE_LENGTH} />

      {/* 남은 시간 · 다시 보내기 */}
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>
          {validSeconds > 0 ? (
            <>
              남은 시간 <Text style={styles.timeStrong}>{left}</Text>
            </>
          ) : (
            "시간이 지났어요. 다시 보내 주세요"
          )}
        </Text>
        <Pressable onPress={resend} disabled={!canResend} hitSlop={8}>
          <Text style={[styles.resendText, !canResend && styles.resendDisabled]}>
            {waitSeconds > 0 ? `${waitSeconds}초 후 다시 보내기` : "다시 보내기"}
          </Text>
        </Pressable>
      </View>
      <View style={styles.spam}>
        <Text style={styles.spamText}>메일이 안 오면 스팸함도 확인해 주세요.</Text>
      </View>

      {error !== "" && <Text style={styles.error}>{error}</Text>}
      {notice !== "" && <Text style={styles.notice}>{notice}</Text>}

      <View style={styles.footer}>
        <PrimaryButton
          title="확인"
          onPress={verify}
          disabled={code.length < CODE_LENGTH}
          loading={verifying}
        />
      </View>

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
    fontSize: 25,
    lineHeight: 34,
    fontWeight: "800",
    color: colors.text,
  },
  guide: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.iconStrong,
  },
  guideStrong: {
    fontWeight: "700",
    color: colors.text,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeText: {
    fontSize: fontSize.label,
    color: colors.iconStrong,
  },
  timeStrong: {
    fontWeight: "700",
    color: colors.primary,
  },
  spam: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
  },
  spamText: {
    fontSize: fontSize.small,
    lineHeight: 19,
    color: colors.iconStrong,
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
  resendText: {
    fontSize: fontSize.label,
    color: colors.primary,
    textDecorationLine: "underline",
  },
  resendDisabled: {
    color: colors.textMuted,
    textDecorationLine: "none",
  },
});
