// ys-182 웰컴 미션 4일차 나에 대해 알려 주세요 · F-210 (2026-11-12)
// 관심 카테고리(1개 이상) + 생활 정보 4가지(모두 선택, 기본 "응답 안 함"). 저장은 서버 함수로만, 본인만 읽힘
// 추천에만 쓰고 결과·CSV·다른 사람에게 보이지 않는다
import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import Chips from "@/components/create/Chips";
import PrimaryButton from "@/components/PrimaryButton";
import Chip from "@/components/ui/Chip";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

type Category = { key: string; name: string };
// "" = 응답 안 함 (서버에는 null로 보낸다)
type Pick = string;

const SKIP = { value: "", label: "응답 안 함" };

const QUESTIONS: { key: "housing" | "commute" | "part_time" | "enrollment"; title: string; options: { value: string; label: string }[] }[] = [
  {
    key: "housing",
    title: "어디에서 지내요?",
    options: [
      { value: "family", label: "본가" },
      { value: "alone", label: "자취" },
      { value: "dorm", label: "기숙사" },
      { value: "other", label: "기타" },
    ],
  },
  {
    key: "commute",
    title: "통학 시간은요? (편도)",
    options: [
      { value: "lt30", label: "30분 미만" },
      { value: "30to60", label: "30분~1시간" },
      { value: "60to90", label: "1시간~1시간 30분" },
      { value: "gte90", label: "1시간 30분 이상" },
    ],
  },
  {
    key: "part_time",
    title: "아르바이트 하고 있어요?",
    options: [
      { value: "yes", label: "해요" },
      { value: "no", label: "안 해요" },
    ],
  },
  {
    key: "enrollment",
    title: "지금 학적 상태는요?",
    options: [
      { value: "enrolled", label: "재학" },
      { value: "leave", label: "휴학" },
      { value: "graduating", label: "졸업 예정" },
      { value: "graduated", label: "졸업" },
    ],
  },
];

type Extras = { interests: string[]; housing: Pick; commute: Pick; part_time: Pick; enrollment: Pick };

export default function AboutMe() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [form, setForm] = useState<Extras>({ interests: [], housing: "", commute: "", part_time: "", enrollment: "" });
  const [saving, setSaving] = useState(false);

  // 카테고리 목록 + 전에 저장한 값
  useFocusEffect(
    useCallback(() => {
      Promise.all([
        supabase.from("survey_categories").select("key, name").order("sort_order"),
        supabase.from("profile_extras").select("interests, housing, commute, part_time, enrollment").maybeSingle(),
      ]).then(([{ data: cats }, { data: saved }]) => {
        setCategories(cats ?? []);
        if (saved) {
          setForm({
            interests: saved.interests ?? [],
            housing: saved.housing ?? "",
            commute: saved.commute ?? "",
            part_time: saved.part_time ?? "",
            enrollment: saved.enrollment ?? "",
          });
        }
      });
    }, []),
  );

  const toggle = (key: string) =>
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(key) ? f.interests.filter((k) => k !== key) : [...f.interests, key],
    }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("save_profile_extras", {
      p_interests: form.interests,
      p_housing: form.housing || null,
      p_commute: form.commute || null,
      p_part_time: form.part_time || null,
      p_enrollment: form.enrollment || null,
    });
    setSaving(false);
    if (error) {
      showNotice("저장하지 못했어요", errorMessage(error));
      return;
    }
    // 미션 화면으로 돌아가면 자동 지급 · 완료 팝업
    router.back();
  };

  if (!categories) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Stack.Screen options={{ title: "나에 대해 알려 주세요" }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "나에 대해 알려 주세요" }} />
      <View style={styles.notice}>
        <Text style={styles.noticeText}>맞는 설문을 먼저 보여 드리는 데에만 써요. 다른 사람에게 보이거나 설문 결과에 들어가지 않아요.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>
          관심 있는 주제를 골라 주세요 <Text style={styles.required}>(1개 이상)</Text>
        </Text>
        <View style={styles.chips}>
          {categories.map((c) => (
            <Chip key={c.key} label={c.name} selected={form.interests.includes(c.key)} onPress={() => toggle(c.key)} />
          ))}
        </View>
      </View>

      {QUESTIONS.map((q) => (
        <View key={q.key} style={styles.section}>
          <Text style={styles.title}>
            {q.title} <Text style={styles.optional}>(선택)</Text>
          </Text>
          <Chips
            options={[...q.options, SKIP]}
            selected={form[q.key]}
            onSelect={(v) => setForm((f) => ({ ...f, [q.key]: v }))}
          />
        </View>
      ))}

      <PrimaryButton title="저장하기" onPress={save} disabled={form.interests.length === 0} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    padding: spacing.md,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  notice: {
    padding: spacing.md - spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primaryFaint,
  },
  noticeText: {
    fontSize: fontSize.small,
    lineHeight: 19,
    color: colors.textStrong,
  },
  section: {
    gap: spacing.sm + 2,
  },
  title: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  required: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.primary,
  },
  optional: {
    fontSize: fontSize.small,
    fontWeight: "500",
    color: colors.textSubtle,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
