// ys-001 회원가입 · F-103 회원정보 입력 ② 나에 대해 (2026-11-14 온보딩 시안 ⑦)
// 자물쇠 안내(왜 묻는지 · 다른 사람에게 안 보임) → 전공 계열 → 과정 → 입학년도 · 출생연도 → 성별 → [가입 완료]
// 가입 완료: complete_signup(닉네임은 ⑥에서) → 초대 코드가 있으면 redeem_invite → 사용 안내(⑧, 가입 직후 모드)
// 포인트 금액은 서버가 정한다 (가입 선물 · 초대 보상)
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppIcon from "@/components/AppIcon";
import { signupStyles as s } from "@/components/onboarding/signupStyles";
import PrimaryButton from "@/components/PrimaryButton";
import StepIndicator from "@/components/StepIndicator";
import YearPicker from "@/components/YearPicker";
import { Text } from "@/components/ui/Text";
import { uiIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { GENDER_OPTIONS, type Gender, birthYearOptions } from "@/lib/demographics";
import { errorMessage } from "@/lib/errors";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

type DegreeType = "undergrad" | "grad";
type MajorField = { id: number; category: string; category_name: string; name: string };

const DEGREE_OPTIONS: { value: DegreeType; label: string }[] = [
  { value: "undergrad", label: "학부" },
  { value: "grad", label: "대학원" },
];

const FIRST_ADMISSION_YEAR = 2000;

export default function SignupAbout() {
  const { agreed, nickname, invite } = useLocalSearchParams<{ agreed?: string; nickname?: string; invite?: string }>();
  const insets = useSafeAreaInsets();

  const [majorFields, setMajorFields] = useState<MajorField[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [majorFieldId, setMajorFieldId] = useState<number | null>(null);
  const [degreeType, setDegreeType] = useState<DegreeType | null>(null);
  const [admissionYear, setAdmissionYear] = useState<number | null>(null);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
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
      .then(({ data, error: loadError }) => {
        if (loadError) {
          setError(errorMessage(loadError));
          return;
        }
        setMajorFields(data ?? []);
      });
  }, []);

  const categories = majorFields.filter((f, i) => majorFields.findIndex((x) => x.category === f.category) === i);
  const fieldsInCategory = majorFields.filter((f) => f.category === category);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - FIRST_ADMISSION_YEAR + 1 }, (_, i) => currentYear - i);

  const canSubmit =
    !!nickname && majorFieldId !== null && degreeType !== null && admissionYear !== null && gender !== null && birthYear !== null;

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    // 회원정보 저장 + 가입 선물 (금액은 서버가 정한다)
    const { error: signupError } = await supabase.rpc("complete_signup", {
      p_nickname: nickname as string,
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
    // 친구 초대 코드 (선택). 안 되더라도 가입은 끝났으니 안내만 하고 넘어간다
    if (invite) {
      const { error: inviteError } = await supabase.rpc("redeem_invite", { p_code: invite });
      if (inviteError) showNotice("초대 코드를 넣지 못했어요", `${errorMessage(inviteError)} 마이 → 친구 초대에서 다시 넣을 수 있어요.`);
    }
    // 가입 직후 사용 안내 4장 → 환영
    router.dismissAll();
    router.replace({ pathname: "/onboarding", params: { from: "signup" } });
  };

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.container} contentInsetAdjustmentBehavior="automatic">
        <Stack.Screen options={{ title: "회원가입" }} />

        <StepIndicator current={6} total={6} />
        <Text style={s.heading}>나에 대해 알려 주세요</Text>

        {/* 왜 묻는지 · 다른 사람에게 안 보임 */}
        <View style={styles.lock}>
          <AppIcon name={uiIcons.lock} size={16} color={colors.primaryStrong} />
          <Text style={styles.lockText}>
            나한테 맞는 설문을 보내고, 결과를 ‘20대 초반 여성 58%’처럼 묶어 볼 때만 써요. 다른 사람에게 내 정보는 보이지 않아요.
          </Text>
        </View>

        <Text style={s.label}>전공 계열</Text>
        <View style={styles.chips}>
          {categories.map((f) => (
            <Chip
              key={f.category}
              label={f.category_name}
              on={category === f.category}
              onPress={() => {
                setCategory(f.category);
                setMajorFieldId(null);
              }}
            />
          ))}
        </View>
        {category !== null && (
          <>
            <Text style={styles.subLabel}>세부 계열을 하나 더 골라 주세요</Text>
            <View style={styles.chips}>
              {fieldsInCategory.map((f) => (
                <Chip key={f.id} label={f.name} on={majorFieldId === f.id} onPress={() => setMajorFieldId(f.id)} />
              ))}
            </View>
          </>
        )}

        <Text style={s.label}>과정</Text>
        <View style={s.optionRow}>
          {DEGREE_OPTIONS.map((o) => (
            <Option key={o.value} label={o.label} on={degreeType === o.value} onPress={() => setDegreeType(o.value)} />
          ))}
        </View>

        <View style={s.optionRow}>
          <View style={styles.half}>
            <Text style={s.label}>입학년도</Text>
            <YearButton value={admissionYear} onPress={() => setYearPickerOpen(true)} />
          </View>
          <View style={styles.half}>
            <Text style={s.label}>출생연도</Text>
            <YearButton value={birthYear} onPress={() => setBirthPickerOpen(true)} />
          </View>
        </View>

        <Text style={s.label}>성별</Text>
        <View style={s.optionRow}>
          {GENDER_OPTIONS.map((o) => (
            <Option key={o.value} label={o.label} on={gender === o.value} onPress={() => setGender(o.value)} />
          ))}
        </View>

        {error !== "" && <Text style={s.error}>{error}</Text>}

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

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <PrimaryButton title="가입 완료" onPress={submit} disabled={!canSubmit} loading={submitting} />
      </View>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress} accessibilityState={{ selected: on }}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Option({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.option, on && s.optionOn]} onPress={onPress} accessibilityState={{ selected: on }}>
      <Text style={[s.optionText, on && s.optionTextOn]}>{label}</Text>
    </Pressable>
  );
}

function YearButton({ value, onPress }: { value: number | null; onPress: () => void }) {
  return (
    <Pressable style={[s.option, styles.yearButton]} onPress={onPress}>
      <Text style={value === null ? styles.yearPlaceholder : s.optionText}>{value === null ? "선택" : `${value}년`}</Text>
      <Text style={styles.yearCaret}>▾</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lock: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryFaint,
  },
  lockText: {
    flex: 1,
    fontSize: fontSize.small,
    lineHeight: 19,
    color: colors.primaryStrong,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  subLabel: {
    marginTop: spacing.xs,
    fontSize: fontSize.caption,
    color: colors.primary,
  },
  chip: {
    height: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.onPrimary,
  },
  chipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: fontSize.label,
    fontWeight: "600",
    color: colors.textStrong,
  },
  chipTextOn: {
    color: colors.onPrimary,
    fontWeight: "700",
  },
  half: {
    flex: 1,
  },
  yearButton: {
    flex: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  yearPlaceholder: {
    fontSize: fontSize.body,
    color: colors.textSubtle,
  },
  yearCaret: {
    fontSize: fontSize.small,
    color: colors.textSubtle,
  },
});
