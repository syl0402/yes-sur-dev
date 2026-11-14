// ys-001 회원가입 · F-103 회원정보 입력 ① 로그인 정보
// 2026-11-14 온보딩 시안 ⑥: 비밀번호 · 비밀번호 확인(눈 버튼) · 닉네임 + "친구한테 초대 코드 받았나요?"(누르면 입력칸)
// [다음] → 비밀번호를 정하고 ⑦ 나에 대해(signup/about)로. 닉네임·초대 코드는 ⑦에서 가입을 마칠 때 함께 보낸다
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { signupStyles as s } from "@/components/onboarding/signupStyles";
import PrimaryButton from "@/components/PrimaryButton";
import StepIndicator from "@/components/StepIndicator";
import HeaderBack from "@/components/ui/HeaderBack";
import PasswordInput from "@/components/ui/PasswordInput";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { confirmLeaveSignup } from "@/lib/leaveSignup";
import { supabase } from "@/lib/supabase";

// 서버(complete_signup)와 같은 규칙. 서버가 한 번 더 검사한다
const MIN_PASSWORD_LENGTH = 8;
// 초대 코드 자릿수 (invite.tsx와 같음)
const CODE_LENGTH = 6;

export default function SignupProfile() {
  const { agreed } = useLocalSearchParams<{ agreed?: string }>();
  const insets = useSafeAreaInsets();

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [nickname, setNickname] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const passwordOk = password.length >= MIN_PASSWORD_LENGTH;
  const passwordMatch = password === passwordConfirm;
  const nicknameLength = nickname.trim().length;
  const nicknameOk = nicknameLength >= 2 && nicknameLength <= 12;
  const inviteOk = invite.trim() === "" || invite.trim().length === CODE_LENGTH;
  const canNext = passwordOk && passwordMatch && nicknameOk && inviteOk;

  const next = async () => {
    if (!canNext || saving) return;
    setSaving(true);
    setError("");
    // 비밀번호 설정 (이전에 같은 비밀번호로 설정됐으면 그대로 진행)
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (passwordError && passwordError.code !== "same_password") {
      setError(errorMessage(passwordError));
      return;
    }
    router.push({
      pathname: "/signup/about",
      params: { agreed, nickname: nickname.trim(), invite: invite.trim().toUpperCase() },
    });
  };

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.container} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
        {/* 인증이 끝난 뒤에는 뒤로 가지 못하게 하고, 대신 "나가기"를 둔다 */}
        <Stack.Screen
          options={{
            title: "회원가입",
            headerBackVisible: false,
            gestureEnabled: false,
            headerLeft: () => <HeaderBack onPress={confirmLeaveSignup} />,
          }}
        />

        <StepIndicator current={5} total={6} />
        <Text style={s.heading}>로그인할 때 쓸 정보예요</Text>

        <Text style={s.label}>비밀번호</Text>
        <PasswordInput style={s.input} value={password} onChangeText={setPassword} placeholder="8자 이상" autoCapitalize="none" />
        {password.length > 0 && !passwordOk && <Text style={s.error}>비밀번호는 8자 이상으로 정해 주세요.</Text>}

        <Text style={s.label}>비밀번호 확인</Text>
        <PasswordInput
          style={s.input}
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
          placeholder="한 번 더 입력"
          autoCapitalize="none"
        />
        {passwordConfirm.length > 0 && !passwordMatch && <Text style={s.error}>비밀번호가 서로 달라요.</Text>}

        <Text style={s.label}>닉네임</Text>
        <TextInput
          style={s.input}
          value={nickname}
          onChangeText={setNickname}
          placeholder="2~12자"
          autoCapitalize="none"
          maxLength={12}
        />
        {nickname.length > 0 && !nicknameOk ? (
          <Text style={s.error}>닉네임은 2~12자로 입력해 주세요.</Text>
        ) : (
          <Text style={s.hint}>커뮤니티에서 보여요. 나중에 바꿀 수 있어요.</Text>
        )}

        {/* 친구 초대 코드 (선택). 누르면 입력칸이 펼쳐진다. 가입을 마치면서 넣는다 */}
        {inviteOpen ? (
          <>
            <Text style={s.label}>친구 초대 코드 (선택)</Text>
            <TextInput
              style={[s.input, { letterSpacing: 2, fontWeight: "700" }]}
              value={invite}
              onChangeText={(t) => setInvite(t.toUpperCase())}
              placeholder="코드 6자리"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={CODE_LENGTH}
            />
            {!inviteOk && <Text style={s.error}>초대 코드는 6자리예요.</Text>}
          </>
        ) : (
          <Pressable onPress={() => setInviteOpen(true)} hitSlop={8} style={{ marginTop: spacing.lg, alignSelf: "flex-start" }}>
            <Text style={{ fontSize: fontSize.label, fontWeight: "700", color: colors.text }}>친구한테 초대 코드 받았나요? ›</Text>
          </Pressable>
        )}

        {error !== "" && <Text style={s.error}>{error}</Text>}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <PrimaryButton title="다음" onPress={next} disabled={!canNext} loading={saving} />
      </View>
    </View>
  );
}
