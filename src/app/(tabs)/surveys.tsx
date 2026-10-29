// ys-110 설문 목록 · F-202~204
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, fontSize, spacing } from "@/constants/theme";
import { formatPoints, formatTimeLeft } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import {
  type DurationKey,
  type SortKey,
  type SurveyCard,
  fetchOpenSurveys,
  matchesDuration,
  sortSurveys,
} from "@/lib/surveys";

type Category = { key: string; name: string };
type Scope = "all" | "campus";

const DURATION_OPTIONS: { value: DurationKey; label: string }[] = [
  { value: "all", label: "전체 시간" },
  { value: "lt5", label: "5분 미만" },
  { value: "5to15", label: "5~15분" },
  { value: "gte15", label: "15분 이상" },
];

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: "all", label: "전체 학교" },
  { value: "campus", label: "우리 학교만" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recommended", label: "추천순" },
  { value: "latest", label: "최신순" },
  { value: "closing", label: "마감 임박순" },
  { value: "reward", label: "보상 높은 순" },
];

export default function Surveys() {
  const [surveys, setSurveys] = useState<SurveyCard[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState("all");
  const [duration, setDuration] = useState<DurationKey>("all");
  const [scope, setScope] = useState<Scope>("all");
  const [sort, setSort] = useState<SortKey>("recommended");

  // 탭에 돌아올 때마다 새로 불러온다 (응답한 설문이 바로 빠지게)
  useFocusEffect(
    useCallback(() => {
      fetchOpenSurveys().then(setSurveys);
      supabase
        .from("survey_categories")
        .select("key, name")
        .order("sort_order")
        .then(({ data }) => setCategories(data ?? []));
    }, []),
  );

  const visible =
    surveys === null
      ? []
      : sortSurveys(
          surveys.filter(
            (s) =>
              (category === "all" || s.category_key === category) &&
              matchesDuration(s, duration) &&
              (scope === "all" || s.audience === "campus"),
          ),
          sort,
        );

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
    >
      <Pressable style={styles.createButton} onPress={() => router.push("/create")}>
        <Text style={styles.createText}>+ 설문 등록</Text>
      </Pressable>

      {/* 필터: 카테고리 · 소요시간 · 학교 범위, 그리고 정렬 */}
      <ChipRow
        options={[{ value: "all", label: "전체" }, ...categories.map((c) => ({ value: c.key, label: c.name }))]}
        selected={category}
        onSelect={setCategory}
      />
      <ChipRow options={DURATION_OPTIONS} selected={duration} onSelect={setDuration} />
      <ChipRow options={SCOPE_OPTIONS} selected={scope} onSelect={setScope} />
      <ChipRow options={SORT_OPTIONS} selected={sort} onSelect={setSort} />

      {surveys === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : visible.length === 0 ? (
        <Text style={styles.empty}>조건에 맞는 설문이 없어요.</Text>
      ) : (
        visible.map((s) => (
          <Pressable
            key={s.id}
            style={styles.card}
            onPress={() => router.push({ pathname: "/survey/[id]", params: { id: String(s.id) } })}
          >
            <View style={styles.cardTop}>
              <Text style={styles.category}>{s.category_name}</Text>
              {s.audience === "campus" && <Text style={styles.campusBadge}>우리 학교</Text>}
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {s.title}
            </Text>
            <View style={styles.cardBottom}>
              <Text style={styles.meta}>
                {[`${s.est_minutes}분`, formatTimeLeft(s.closes_at)].filter(Boolean).join(" · ")}
              </Text>
              <Text style={styles.reward}>{formatPoints(s.reward_points)}</Text>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

// 가로로 넘기는 선택 칩 한 줄
function ChipRow<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          style={[styles.chip, selected === o.value && styles.chipSelected]}
          onPress={() => onSelect(o.value)}
        >
          <Text style={[styles.chipText, selected === o.value && styles.chipTextSelected]}>{o.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  loading: {
    marginTop: spacing.lg,
  },
  createButton: {
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    alignItems: "center",
  },
  createText: {
    fontSize: fontSize.body,
    color: colors.primary,
    fontWeight: "600",
  },
  empty: {
    marginTop: spacing.lg,
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: "center",
  },
  chipRow: {
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
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
  card: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    gap: 6,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  category: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  campusBadge: {
    fontSize: fontSize.small,
    color: colors.primary,
    fontWeight: "600",
  },
  title: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  meta: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  reward: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.primary,
  },
});
