// ys-001 회원가입 · F-102 학교 선택·이메일 입력 (단체는 아무 메일)
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import { colors, fontSize, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

type University = { id: number; name: string; email_domain: string };

// 단체 메일 형식 검사 (자세한 검사는 인증번호 메일이 대신한다)
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupEmail() {
  const { agreed, type } = useLocalSearchParams<{ agreed?: string; type?: string }>();
  const isOrg = type === "org";

  const [universities, setUniversities] = useState<University[]>([]);
  const [selected, setSelected] = useState<University | null>(null);
  const [localPart, setLocalPart] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
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

  // 학생: 학교 선택 + 아이디 (도메인 고정)
  const trimmed = localPart.trim();
  const isValidLocalPart = trimmed.length > 0 && !/[\s@]/.test(trimmed);
  // 단체: 메일 주소 전체
  const trimmedOrgEmail = orgEmail.trim();
  const isValidOrgEmail = EMAIL_PATTERN.test(trimmedOrgEmail);

  const canSend = isOrg ? isValidOrgEmail : selected !== null && isValidLocalPart;

  const sendCode = async () => {
    if (!canSend) return;
    setSending(true);
    setError("");

    const email = isOrg ? trimmedOrgEmail : `${trimmed}@${selected?.email_domain}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    setSending(false);
    if (error) {
      setError(errorMessage(error));
      return;
    }
    router.push({ pathname: "/signup/verify", params: { email, agreed, type } });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "회원가입" }} />

      {isOrg ? (
        <>
          <Text style={styles.heading}>단체 공식 메일을 입력해 주세요</Text>
          <Text style={styles.guide}>
            학생회·동아리 공식 메일이나 기관·회사 메일을 써 주세요. 승인할 때 단체 확인에 참고하고,
            로그인 아이디로도 써요.
          </Text>
          <TextInput
            style={styles.input}
            value={orgEmail}
            onChangeText={setOrgEmail}
            placeholder="example@gmail.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          {orgEmail.length > 0 && !isValidOrgEmail && (
            <Text style={styles.error}>메일 주소 형식을 확인해 주세요.</Text>
          )}
        </>
      ) : (
        <Text style={styles.heading}>학교를 선택해 주세요</Text>
      )}

      {!isOrg && universities.map((u) => (
        <Pressable
          key={u.id}
          style={[styles.school, selected?.id === u.id && styles.schoolSelected]}
          onPress={() => setSelected(u)}
        >
          <Text style={styles.schoolName}>{u.name}</Text>
          <Text style={styles.schoolDomain}>@{u.email_domain}</Text>
        </Pressable>
      ))}

      {!isOrg && selected && (
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
          disabled={!canSend}
          loading={sending}
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
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  guide: {
    fontSize: fontSize.small,
    color: colors.textMuted,
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
