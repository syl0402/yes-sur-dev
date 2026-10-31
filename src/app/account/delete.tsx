// ys-154 회원 탈퇴 · F-106 (Google Play 계정 삭제 정책) · 현재 비밀번호 확인 후 서버가 처리 (2026-10-30)
import { Stack, router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import { showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

export default function DeleteAccount() {
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setDeleting(true);
    setError("");

    // 1. 현재 비밀번호 확인 (휴대폰을 잠깐 빌린 사람이 탈퇴시키지 못하게)
    const { data: auth } = await supabase.auth.getUser();
    const email = auth.user?.email ?? "";
    const { error: checkError } = await supabase.auth.signInWithPassword({ email, password });
    if (checkError) {
      setDeleting(false);
      setError("비밀번호가 맞지 않아요.");
      return;
    }

    // 2. 탈퇴 (설문 마감·삭제, 계정 삭제는 서버가 한 번에)
    const { error: deleteError } = await supabase.rpc("delete_my_account");
    if (deleteError) {
      setDeleting(false);
      setError(errorMessage(deleteError));
      return;
    }

    // 3. 이 폰의 로그인 정보 지우고 첫 화면으로
    await supabase.auth.signOut({ scope: "local" });
    setDeleting(false);
    showNotice("탈퇴했어요", "그동안 옛썰을 이용해 주셔서 고마워요.", () => {
      router.dismissAll();
      router.replace("/");
    });
  };

  const confirmDelete = () =>
    showConfirm({
      title: "정말 탈퇴할까요?",
      message: "탈퇴하면 되돌릴 수 없어요.",
      okLabel: "탈퇴",
      cancelLabel: "취소",
      destructive: true,
      onOk: run,
    });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "회원 탈퇴" }} />

      <Text style={styles.title}>탈퇴하기 전에 확인해 주세요</Text>

      <View style={styles.box}>
        <Text style={styles.boxTitle}>사라지는 것</Text>
        <Text style={styles.body}>
          · 계정과 회원정보{"\n"}· 남은 포인트와 포인트 내역 (돌려받을 수 없어요){"\n"}· ‘나만 보기’로 올린 설문과 그 결과
        </Text>
      </View>

      <View style={styles.box}>
        <Text style={styles.boxTitle}>남는 것 (누구인지 알 수 없게)</Text>
        <Text style={styles.body}>
          · 다른 설문에 남긴 응답: 이름 없이 통계에만 남아요{"\n"}· 공개된 내 설문 결과: 데이터 허브에 그대로 남아요 (개인 설문은 원래처럼 ‘개인’으로만 표시)
        </Text>
      </View>

      <View style={styles.box}>
        <Text style={styles.boxTitle}>마감되는 것</Text>
        <Text style={styles.body}>· 진행 중인 내 설문은 바로 마감돼요 (등록비는 돌려받을 수 없어요)</Text>
      </View>

      <Text style={styles.hint}>같은 메일로 다시 가입할 수 있지만, 웰컴 포인트는 다시 받을 수 없어요.</Text>

      <Text style={styles.label}>현재 비밀번호</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        placeholder="비밀번호를 입력해 주세요"
      />
      {error !== "" && <Text style={styles.error}>{error}</Text>}

      <PrimaryButton title="탈퇴하기" onPress={confirmDelete} disabled={password.length === 0} loading={deleting} />
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
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
  },
  box: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    gap: spacing.sm,
  },
  boxTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  body: {
    fontSize: fontSize.body,
    color: colors.text,
    lineHeight: 22,
  },
  hint: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  label: {
    marginTop: spacing.sm,
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.text,
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
