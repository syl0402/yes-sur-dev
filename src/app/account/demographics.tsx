// ys-152 성별·출생연도 입력 (기존 회원 한 번만) · 데이터 허브 나눠 보기용 (2026-10-30)
import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import YearPicker from "@/components/YearPicker";
import { colors, fontSize, spacing } from "@/constants/theme";
import { GENDER_OPTIONS, type Gender, birthYearOptions } from "@/lib/demographics";
import { errorMessage } from "@/lib/errors";
import { showConfirm } from "@/lib/confirm";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

// 기능 추가 전에 가입한 학생만 비어 있다. 한 번 저장하면 고정 (고치려면 문의, 서버도 막음)
export default function MyInfo() {
  const [loaded, setLoaded] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    supabase
      .from("profiles")
      .select("gender, birth_year")
      .maybeSingle()
      .then(({ data }) => {
        setGender((data?.gender as Gender | null) ?? null);
        setBirthYear(data?.birth_year ?? null);
        setLoaded(true);
      });
  }, []);

  // 한 번 정하면 바꿀 수 없으니 저장 전에 확인
  const confirmSave = () =>
    showConfirm({
      title: "이대로 저장할까요?",
      message: `${GENDER_OPTIONS.find((g) => g.value === gender)?.label} · ${birthYear}년\n저장한 뒤에는 바꿀 수 없어요.`,
      okLabel: "저장",
      cancelLabel: "다시 보기",
      onOk: save,
    });

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("update_my_demographics", {
      p_gender: gender,
      p_birth_year: birthYear,
    });
    setSaving(false);
    if (error) {
      showNotice("저장하지 못했어요", errorMessage(error));
      return;
    }
    showNotice("저장했어요", "", () => router.back());
  };

  if (!loaded) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "성별·출생연도 입력" }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "성별·출생연도 입력" }} />

      <Text style={styles.note}>
        성별·출생연도는 설문 결과를 묶어서 볼 때만 쓰여요 (예: ‘20대 초반 여성 58%’). 다른 사람에게 내 정보가 보이지 않아요. 한 번 저장하면 바꿀 수 없어요.
      </Text>

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
      <Pressable style={styles.input} onPress={() => setPickerOpen(true)}>
        <Text style={birthYear === null ? styles.placeholder : styles.inputText}>
          {birthYear === null ? "선택해 주세요" : `${birthYear}년`}
        </Text>
      </Pressable>

      <View style={styles.footer}>
        <PrimaryButton title="저장" onPress={confirmSave} disabled={gender === null || birthYear === null} loading={saving} />
      </View>

      <YearPicker
        visible={pickerOpen}
        title="출생연도"
        years={birthYearOptions(currentYear)}
        selected={birthYear}
        onSelect={setBirthYear}
        onClose={() => setPickerOpen(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  note: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  label: {
    marginTop: spacing.md,
    fontSize: fontSize.small,
    color: colors.textMuted,
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
    borderRadius: 10,
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
  },
  inputText: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  placeholder: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  footer: {
    marginTop: spacing.lg,
  },
});
