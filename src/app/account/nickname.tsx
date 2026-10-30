// ys-155 닉네임 바꾸기 · F-104 (학생만, n일에 한 번. 커뮤니티 글·댓글에 보이는 이름)
import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput } from "react-native";

import { formStyles } from "@/components/create/formStyles";
import PrimaryButton from "@/components/PrimaryButton";
import { colors, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { showNotice } from "@/lib/notice";
import { fetchRules } from "@/lib/rules";
import { supabase } from "@/lib/supabase";

// 가입 때와 같은 규칙 (서버가 한 번 더 검사)
const NICKNAME_MIN = 2;
const NICKNAME_MAX = 12;

export default function ChangeNickname() {
  const [current, setCurrent] = useState<string | null>(null);
  const [changedAt, setChangedAt] = useState<string | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("profiles")
      .select("nickname, nickname_changed_at")
      .maybeSingle()
      .then(({ data }) => {
        setCurrent(data?.nickname ?? "");
        setChangedAt(data?.nickname_changed_at ?? null);
        setNickname(data?.nickname ?? "");
      });
    fetchRules(["nickname_change_days"]).then((r) => setDays(r.nickname_change_days ?? null));
  }, []);

  const trimmed = nickname.trim();
  const valid = trimmed.length >= NICKNAME_MIN && trimmed.length <= NICKNAME_MAX && trimmed !== current;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    const { error: saveError } = await supabase.rpc("change_nickname", { p_nickname: trimmed });
    setSaving(false);
    if (saveError) {
      setError(errorMessage(saveError));
      return;
    }
    showNotice("닉네임을 바꿨어요", `이제 커뮤니티에서 "${trimmed}"(으)로 보여요.`, () => router.back());
  };

  if (current === null) {
    return <ActivityIndicator color={colors.primary} style={styles.loading} />;
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "닉네임 바꾸기" }} />

      <Text style={formStyles.label}>새 닉네임</Text>
      <TextInput
        style={formStyles.input}
        value={nickname}
        onChangeText={setNickname}
        maxLength={NICKNAME_MAX}
        autoCapitalize="none"
      />
      <Text style={formStyles.hint}>
        {NICKNAME_MIN}~{NICKNAME_MAX}자 · 커뮤니티 글과 댓글에 보이는 이름이에요.
        {days !== null ? `\n한 번 바꾸면 ${days}일 동안 다시 바꿀 수 없어요.` : ""}
        {changedAt ? `\n마지막으로 바꾼 날: ${formatDate(changedAt)}` : ""}
      </Text>

      {error !== "" && <Text style={formStyles.error}>{error}</Text>}

      <PrimaryButton title="바꾸기" onPress={save} disabled={!valid} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
});
