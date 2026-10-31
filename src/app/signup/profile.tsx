// ys-001 회원가입 · F-103 회원정보 입력
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import StepIndicator from "@/components/StepIndicator";
import YearPicker from "@/components/YearPicker";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { GENDER_OPTIONS, type Gender, birthYearOptions } from "@/lib/demographics";
import { errorMessage } from "@/lib/errors";
import { confirmLeaveSignup } from "@/lib/leaveSignup";
import { supabase } from "@/lib/supabase";

type DegreeType = "undergrad" | "grad";
type MajorField = { id: number; category: string; category_name: string; name: string };

const DEGREE_OPTIONS: { value: DegreeType; label: string }[] = [
  { value: "undergrad", label: "학부" },
  { value: "grad", label: "대학원" },
];

// 서버(complete_signup)와 같은 규칙. 서버가 한 번 더 검사한다
const MIN_PASSWORD_LENGTH = 8;
const FIRST_ADMISSION_YEAR = 2000;

export default function SignupProfile() {
  const { agreed } = useLocalSearchParams<{ agreed?: string }>();

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [nickname, setNickname] = useState("");
  const [majorFields, setMajorFields] = useState<MajorField[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [majorFieldId, setMajorFieldId] = useState<number | null>(null);
  const [degreeType, setDegreeType] = useState<DegreeType | null>(null);
  const [admissionYear, setAdmissionYear] = useState<number | null>(null);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  // 통계(나눠 보기)용 응답자 정보 (2026-10-30 추가)
  const [gender, setGender] = useState<Gender | null>(null);
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [birthPickerOpen, setBirthPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 전공 계열 목록 (대계열 7 → 중계열 35, 전국 공통)
  useEffect(() => {
    supabase
      .from("major_fields")
      .select("id, category, category_name, name")
      .order("sort_order")
      .then(({ data, error }) => {
        if (error) {
          setError(errorMessage(error));
          return;
        }
        setMajorFields(data ?? []);
      });
  }, []);

  // 대계열 버튼: 목록 순서대로 중복 없이
  const categories = majorFields.filter(
    (field, index) => majorFields.findIndex((f) => f.category === field.category) === index,
  );
  const fieldsInCategory = majorFields.filter((field) => field.category === category);

  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentYear - FIRST_ADMISSION_YEAR + 1 },
    (_, i) => currentYear - i,
  );

  const passwordOk = password.length >= MIN_PASSWORD_LENGTH;
  const passwordMatch = password === passwordConfirm;
  const nicknameLength = nickname.trim().length;
  const nicknameOk = nicknameLength >= 2 && nicknameLength <= 12;

  const canSubmit =
    passwordOk &&
    passwordMatch &&
    nicknameOk &&
    majorFieldId !== null &&
    degreeType !== null &&
    admissionYear !== null &&
    gender !== null &&
    birthYear !== null;

  const chooseCategory = (value: string) => {
    setCategory(value);
    setMajorFieldId(null);
  };

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");

    // 1. 비밀번호 설정 (이전에 같은 비밀번호로 설정됐으면 그대로 진행)
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError && passwordError.code !== "same_password") {
      setSubmitting(false);
      setError(errorMessage(passwordError));
      return;
    }

    // 2. 회원정보 저장 + 웰컴 포인트 지급 (금액은 서버가 정한다)
    const { error: signupError } = await supabase.rpc("complete_signup", {
      p_nickname: nickname.trim(),
      p_major_field_id: majorFieldId,
      p_admission_year: admissionYear,
      p_degree_type: degreeType,
      p_terms_agreed: agreed === "1",
      p_gender: gender,
      p_birth_year: birthYear,
    });
    if (signupError) {
      setSubmitting(false);
      setError(errorMessage(signupError));
      return;
    }

    router.replace("/signup/done");
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
          title: "회원가입",
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
      <Text style={styles.heading}>회원정보를 입력해 주세요</Text>

      <Text style={styles.label}>비밀번호</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="8자 이상"
        secureTextEntry
        autoCapitalize="none"
      />
      {password.length > 0 && !passwordOk && (
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
      {passwordConfirm.length > 0 && !passwordMatch && (
        <Text style={styles.error}>비밀번호가 서로 달라요.</Text>
      )}

      <Text style={styles.label}>닉네임</Text>
      <TextInput
        style={styles.input}
        value={nickname}
        onChangeText={setNickname}
        placeholder="2~12자"
        autoCapitalize="none"
        maxLength={12}
      />
      {nickname.length > 0 && !nicknameOk && (
        <Text style={styles.error}>닉네임은 2~12자로 입력해 주세요.</Text>
      )}

      <Text style={styles.label}>전공 계열</Text>
      <View style={styles.chipWrap}>
        {categories.map((field) => (
          <Chip
            key={field.category}
            label={field.category_name}
            selected={category === field.category}
            onPress={() => chooseCategory(field.category)}
          />
        ))}
      </View>
      {category !== null && (
        <View style={[styles.chipWrap, styles.subChips]}>
          {fieldsInCategory.map((field) => (
            <Chip
              key={field.id}
              label={field.name}
              selected={majorFieldId === field.id}
              onPress={() => setMajorFieldId(field.id)}
            />
          ))}
        </View>
      )}
      {category !== null && majorFieldId === null && (
        <Text style={styles.hint}>아래에서 세부 계열을 하나 더 골라 주세요.</Text>
      )}

      <Text style={styles.label}>과정</Text>
      <View style={styles.choiceRow}>
        {DEGREE_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            style={[styles.choice, degreeType === option.value && styles.choiceSelected]}
            onPress={() => setDegreeType(option.value)}
          >
            <Text
              style={[styles.choiceText, degreeType === option.value && styles.choiceTextSelected]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>입학년도</Text>
      <Pressable style={styles.input} onPress={() => setYearPickerOpen(true)}>
        <Text style={admissionYear === null ? styles.placeholder : styles.inputText}>
          {admissionYear === null ? "선택해 주세요" : `${admissionYear}년`}
        </Text>
      </Pressable>

      <Text style={styles.label}>성별</Text>
      <View style={styles.choiceRow}>
        {GENDER_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            style={[styles.choice, gender === option.value && styles.choiceSelected]}
            onPress={() => setGender(option.value)}
          >
            <Text style={[styles.choiceText, gender === option.value && styles.choiceTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>출생연도</Text>
      <Pressable style={styles.input} onPress={() => setBirthPickerOpen(true)}>
        <Text style={birthYear === null ? styles.placeholder : styles.inputText}>
          {birthYear === null ? "선택해 주세요" : `${birthYear}년`}
        </Text>
      </Pressable>
      <Text style={styles.note}>
        성별·출생연도는 설문 결과를 묶어서 볼 때만 쓰여요 (예: ‘20대 초반 여성 58%’). 다른 사람에게 내 정보가 보이지 않아요.
      </Text>

      {error !== "" && <Text style={styles.error}>{error}</Text>}

      <View style={styles.footer}>
        <PrimaryButton
          title="가입 완료"
          onPress={submit}
          disabled={!canSubmit}
          loading={submitting}
        />
      </View>

      <YearPicker
        visible={yearPickerOpen}
        title="입학년도"
        years={years}
        selected={admissionYear}
        onSelect={setAdmissionYear}
        onClose={() => setYearPickerOpen(false)}
      />
      <YearPicker
        visible={birthPickerOpen}
        title="출생연도"
        years={birthYearOptions(currentYear)}
        selected={birthYear}
        onSelect={setBirthYear}
        onClose={() => setBirthPickerOpen(false)}
      />
    </ScrollView>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
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
    gap: spacing.sm,
    backgroundColor: colors.background,
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
  inputText: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  placeholder: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  subChips: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
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
  choiceRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  choice: {
    flex: 1,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
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
  error: {
    fontSize: fontSize.small,
    color: colors.danger,
  },
  hint: {
    fontSize: fontSize.small,
    color: colors.primary,
  },
  leave: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  footer: {
    marginTop: spacing.lg,
  },
  note: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
});
