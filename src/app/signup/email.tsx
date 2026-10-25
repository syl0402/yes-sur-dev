// ys-001 회원가입 · F-102 학교 선택·이메일 입력
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import { colors, fontSize, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

type University = { id: number; name: string; email_domain: string };

export default function SignupEmail() {
  const { agreed } = useLocalSearchParams<{ agreed?: string }>();

  const [universities, setUniversities] = useState<University[]>([]);
  const [selected, setSelected] = useState<University | null>(null);
  const [localPart, setLocalPart] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("universities")
      .select("id, name, email_domain")
      .order("name")
      .then(({ data, error }) => {
        if (error) {
          setError(errorMessage(error));
          return;
        }
        setUniversities(data ?? []);
        // 학교가 하나뿐이면 미리 골라 둔다
        if (data?.length === 1) setSelected(data[0]);
      });
  }, []);

  const trimmed = localPart.trim();
  const isValidLocalPart = trimmed.length > 0 && !/[\s@]/.test(trimmed);

  const sendCode = async () => {
    if (!selected || !isValidLocalPart) return;
    setSending(true);
    setError("");

    const email = `${trimmed}@${selected.email_domain}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    setSending(false);
    if (error) {
      setError(errorMessage(error));
      return;
    }
    router.push({ pathname: "/signup/verify", params: { email, agreed } });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "회원가입" }} />

      <Text style={styles.heading}>학교를 선택해 주세요</Text>

      {universities.map((u) => (
        <Pressable
          key={u.id}
          style={[styles.school, selected?.id === u.id && styles.schoolSelected]}
          onPress={() => setSelected(u)}
        >
          <Text style={styles.schoolName}>{u.name}</Text>
          <Text style={styles.schoolDomain}>@{u.email_domain}</Text>
        </Pressable>
      ))}

      {selected && (
        <>
          <Text style={styles.label}>학교 이메일</Text>
          <View style={styles.emailRow}>
            <TextInput
              style={styles.input}
              value={localPart}
              onChangeText={setLocalPart}
              placeholder="아이디"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            <Text style={styles.domain}>@{selected.email_domain}</Text>
          </View>
          {localPart.length > 0 && !isValidLocalPart && (
            <Text style={styles.error}>@ 앞부분만 입력해 주세요.</Text>
          )}
        </>
      )}

      {error !== "" && <Text style={styles.error}>{error}</Text>}

      <View style={styles.footer}>
        <PrimaryButton
          title="인증번호 보내기"
          onPress={sendCode}
          disabled={!selected || !isValidLocalPart}
          loading={sending}
        />
      </View>
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
    marginBottom: spacing.sm,
  },
  school: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  schoolSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  schoolName: {
    fontSize: fontSize.body,
    color: colors.text,
    fontWeight: "600",
  },
  schoolDomain: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  label: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: fontSize.body,
    color: colors.text,
  },
  domain: {
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
