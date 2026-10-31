// ys-153 비밀번호 변경 (로그인 상태) · 현재 비밀번호 확인 후 새 비밀번호 (2026-10-30)
import { Stack, router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

// 가입·비밀번호 찾기와 같은 규칙
const MIN_PASSWORD_LENGTH = 8;

export default function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const passwordOk = password.length >= MIN_PASSWORD_LENGTH;
  const passwordMatch = password === passwordConfirm;
  const canSave = current.length > 0 && passwordOk && passwordMatch;

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError("");

    // 1. 현재 비밀번호 확인 (휴대폰을 잠깐 빌린 사람이 바꾸지 못하게)
    const { data: auth } = await supabase.auth.getUser();
    const email = auth.user?.email ?? "";
    const { error: checkError } = await supabase.auth.signInWithPassword({ email, password: current });
    if (checkError) {
      setSaving(false);
      setError("현재 비밀번호가 맞지 않아요.");
      return;
    }

    // 2. 새 비밀번호로 변경
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError && updateError.code !== "same_password") {
      setError(errorMessage(updateError));
      return;
    }

    showNotice("비밀번호를 바꿨어요", "다음 로그인부터 새 비밀번호를 써 주세요.", () => router.back());
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "비밀번호 변경" }} />

      <Text style={styles.label}>현재 비밀번호</Text>
      <TextInput style={styles.input} value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" />

      <Text style={styles.label}>새 비밀번호</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="8자 이상"
        secureTextEntry
        autoCapitalize="none"
      />
      {password.length > 0 && !passwordOk && <Text style={styles.error}>비밀번호는 8자 이상으로 정해 주세요.</Text>}

      <Text style={styles.label}>새 비밀번호 확인</Text>
      <TextInput
        style={styles.input}
        value={passwordConfirm}
        onChangeText={setPasswordConfirm}
        placeholder="한 번 더 입력"
        secureTextEntry
        autoCapitalize="none"
      />
      {passwordConfirm.length > 0 && !passwordMatch && <Text style={styles.error}>비밀번호가 서로 달라요.</Text>}

      {error !== "" && <Text style={styles.error}>{error}</Text>}

      <PrimaryButton title="변경" onPress={save} disabled={!canSave} loading={saving} />
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
});
