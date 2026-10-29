// ys-001 회원가입 · F-103 단체 정보 입력 (처음 신청 / 거절 후 재신청)
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import StepIndicator from "@/components/StepIndicator";
import { colors, fontSize, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { confirmLeaveSignup } from "@/lib/leaveSignup";
import { supabase } from "@/lib/supabase";

type OrgKind = "campus" | "external";
type University = { id: number; name: string };

const KIND_OPTIONS: { value: OrgKind; label: string; example: string }[] = [
  { value: "campus", label: "교내 단체", example: "학생회·동아리·센터·연구실" },
  { value: "external", label: "외부 단체", example: "기업·연구기관" },
];

// 서버(request_org_signup)와 같은 규칙. 서버가 한 번 더 검사한다
const NAME_MIN = 2;
const NAME_MAX = 30;
const DESCRIPTION_MAX = 200;
const MIN_PASSWORD_LENGTH = 8;

export default function SignupOrgInfo() {
  // resubmit=1: 거절된 뒤 다시 신청 (비밀번호는 이미 정했으므로 칸을 숨긴다)
  const { agreed, resubmit } = useLocalSearchParams<{ agreed?: string; resubmit?: string }>();
  const isResubmit = resubmit === "1";

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [universities, setUniversities] = useState<University[]>([]);
  const [kind, setKind] = useState<OrgKind | null>(null);
  const [universityId, setUniversityId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // 교내 단체용 학교 목록
    supabase
      .from("universities")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        setUniversities(data ?? []);
        if (data?.length === 1) setUniversityId(data[0].id);
      });

    // 거절 후 재신청이면 예전에 쓴 내용을 채워 둔다
    supabase
      .from("organizations")
      .select("kind, name, university_id, evidence_url, description")
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setKind(data.kind as OrgKind);
        if (data.university_id !== null) setUniversityId(data.university_id);
        setName(data.name);
        setEvidenceUrl(data.evidence_url);
        setDescription(data.description ?? "");
      });
  }, []);

  const nameLength = name.trim().length;
  const nameOk = nameLength >= NAME_MIN && nameLength <= NAME_MAX;
  const evidenceOk = /^https?:\/\//i.test(evidenceUrl.trim());
  const descriptionOk = description.trim().length <= DESCRIPTION_MAX;
  const schoolOk = kind === "external" || universityId !== null;

  const passwordOk = isResubmit || password.length >= MIN_PASSWORD_LENGTH;
  const passwordMatch = isResubmit || password === passwordConfirm;

  const canSubmit =
    passwordOk && passwordMatch && kind !== null && schoolOk && nameOk && evidenceOk && descriptionOk;

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");

    // 1. 로그인용 비밀번호 설정 (재신청이면 건너뜀, 같은 비밀번호로 이미 설정됐으면 그대로 진행)
    if (!isResubmit) {
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError && passwordError.code !== "same_password") {
        setSubmitting(false);
        setError(errorMessage(passwordError));
        return;
      }
    }

    // 2. 단체 신청

    const { error } = await supabase.rpc("request_org_signup", {
      p_kind: kind,
      p_name: name.trim(),
      p_university_id: kind === "campus" ? universityId : null,
      p_evidence_url: evidenceUrl.trim(),
      p_description: description.trim(),
      p_terms_agreed: agreed === "1",
    });
    if (error) {
      setSubmitting(false);
      setError(errorMessage(error));
      return;
    }

    router.replace("/signup/pending");
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      {/* 인증이 끝난 뒤에는 뒤로 가지 못하게 하고, 대신 "나가기"를 둔다 */}
      <Stack.Screen
        options={{
          title: "단체 가입",
          headerBackVisible: false,
          gestureEnabled: false,
          headerLeft: () => (
            <Pressable onPress={confirmLeaveSignup} hitSlop={8}>
              <Text style={styles.leave}>나가기</Text>
            </Pressable>
          ),
        }}
      />

      <StepIndicator current={5} total={5} />
      <Text style={styles.heading}>단체 정보를 입력해 주세요</Text>
      <Text style={styles.guide}>운영자가 확인한 뒤 승인하면 단체 이름으로 설문을 올릴 수 있어요.</Text>

      {!isResubmit && (
        <>
          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="8자 이상 (로그인할 때 써요)"
            secureTextEntry
            autoCapitalize="none"
          />
          {password.length > 0 && password.length < MIN_PASSWORD_LENGTH && (
            <Text style={styles.error}>비밀번호는 8자 이상으로 정해 주세요.</Text>
          )}

          <Text style={styles.label}>비밀번호 확인</Text>
          <TextInput
            style={styles.input}
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            placeholder="한 번 더 입력"
            secureTextEntry
            autoCapitalize="none"
          />
          {passwordConfirm.length > 0 && password !== passwordConfirm && (
            <Text style={styles.error}>비밀번호가 서로 달라요.</Text>
          )}
        </>
      )}

      <Text style={styles.label}>단체 종류</Text>
      <View style={styles.choiceRow}>
        {KIND_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            style={[styles.choice, kind === option.value && styles.choiceSelected]}
            onPress={() => setKind(option.value)}
          >
            <Text style={[styles.choiceText, kind === option.value && styles.choiceTextSelected]}>
              {option.label}
            </Text>
            <Text style={styles.choiceExample}>{option.example}</Text>
          </Pressable>
        ))}
      </View>

      {kind === "campus" && (
        <>
          <Text style={styles.label}>학교</Text>
          <View style={styles.chipWrap}>
            {universities.map((u) => (
              <Pressable
                key={u.id}
                style={[styles.chip, universityId === u.id && styles.chipSelected]}
                onPress={() => setUniversityId(u.id)}
              >
                <Text style={[styles.chipText, universityId === u.id && styles.chipTextSelected]}>
                  {u.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Text style={styles.label}>단체 이름</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={kind === "external" ? "예: 옛썰리서치" : "예: 경영학과 학생회"}
        maxLength={NAME_MAX}
      />
      {name.length > 0 && !nameOk ? (
        <Text style={styles.error}>단체 이름은 2~30자로 입력해 주세요.</Text>
      ) : (
        // 설문에 보일 작성자 이름 미리보기 (교내 단체는 서버가 학교 이름을 앞에 붙인다)
        <Text style={styles.counter}>
          {kind === "campus"
            ? `학교 이름은 자동으로 앞에 붙어요. 설문에는 "${universities.find((u) => u.id === universityId)?.name ?? "학교"} ${name.trim() || "경영학과 학생회"}"로 보여요.`
            : "정식 이름으로 적어 주세요. 운영자가 확인한 뒤 승인해요."}
        </Text>
      )}

      <Text style={styles.label}>증빙 링크</Text>
      <TextInput
        style={styles.input}
        value={evidenceUrl}
        onChangeText={setEvidenceUrl}
        placeholder="공식 인스타그램·홈페이지 주소 (https://...)"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      {evidenceUrl.length > 0 && !evidenceOk && (
        <Text style={styles.error}>http:// 또는 https://로 시작하는 주소를 넣어 주세요.</Text>
      )}

      <Text style={styles.label}>소개 (선택)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        placeholder="어떤 단체인지 한두 줄로 알려 주세요."
        multiline
        maxLength={DESCRIPTION_MAX}
      />
      <Text style={styles.counter}>
        {description.length}/{DESCRIPTION_MAX}
      </Text>

      {error !== "" && <Text style={styles.error}>{error}</Text>}

      <View style={styles.footer}>
        <PrimaryButton
          title="승인 신청"
          onPress={submit}
          disabled={!canSubmit}
          loading={submitting}
        />
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
  },
  guide: {
    fontSize: fontSize.small,
    color: colors.textMuted,
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
    borderRadius: 10,
    padding: spacing.md,
    fontSize: fontSize.body,
    color: colors.text,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  counter: {
    alignSelf: "flex-end",
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  choiceRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  choice: {
    flex: 1,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    alignItems: "center",
    gap: 4,
  },
  choiceSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  choiceText: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  choiceTextSelected: {
    color: colors.primary,
    fontWeight: "600",
  },
  choiceExample: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: fontSize.small,
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.onPrimary,
    fontWeight: "600",
  },
  error: {
    fontSize: fontSize.small,
    color: colors.danger,
  },
  leave: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  footer: {
    marginTop: spacing.lg,
  },
});
