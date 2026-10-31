// ys-011 계정 찾기 · F-107 비밀번호 찾기: 새 비밀번호 정하기
import { router, Stack } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

// 가입 때와 같은 규칙
const MIN_PASSWORD_LENGTH = 8;

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const passwordOk = password.length >= MIN_PASSWORD_LENGTH;
  const passwordMatch = password === passwordConfirm;
  const canSave = passwordOk && passwordMatch;

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError("");

    const { error } = await supabase.auth.updateUser({ password });
    // 예전과 같은 비밀번호여도 그대로 쓰면 되므로 통과
    if (error && error.code !== "same_password") {
      setSaving(false);
      setError(errorMessage(error));
      return;
    }

    // 인증번호로 이미 로그인된 상태 → 그대로 첫 화면
    showNotice("비밀번호를 바꿨어요", "새 비밀번호로 로그인돼 있어요.", () => router.replace("/"));
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      {/* 본인 확인이 끝난 뒤라 인증 화면으로 돌아가지 못하게 한다 */}
      <Stack.Screen
        options={{ title: "비밀번호 찾기", headerBackVisible: false, gestureEnabled: false }}
      />

      <Text style={styles.heading}>새 비밀번호를 정해 주세요</Text>

      <Text style={styles.label}>새 비밀번호</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="8자 이상"
        secureTextEntry
        autoCapitalize="none"
        textContentType="newPassword"
      />
      {password.length > 0 && !passwordOk && (
        <Text style={styles.error}>비밀번호는 8자 이상으로 정해 주세요.</Text>
      )}

      <Text style={styles.label}>새 비밀번호 확인</Text>
      <TextInput
        style={styles.input}
        value={passwordConfirm}
        onChangeText={setPasswordConfirm}
        placeholder="한 번 더 입력"
        secureTextEntry
        autoCapitalize="none"
      />
      {passwordConfirm.length > 0 && !passwordMatch && (
        <Text style={styles.error}>비밀번호가 서로 달라요.</Text>
      )}

      {error !== "" && <Text style={styles.error}>{error}</Text>}

      <View style={styles.footer}>
        <PrimaryButton title="비밀번호 바꾸기" onPress={save} disabled={!canSave} loading={saving} />
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
    borderRadius: radius.md,
    backgroundColor: colors.surface,
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
});
