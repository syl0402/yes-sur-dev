// ys-110 설문 목록 · F-202~204
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import SurveyListCard from "@/components/SurveyListCard";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import EmptyState from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
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
      {/* 필터: 카테고리 · 소요시간 · 학교 범위, 그리고 정렬 */}
      <View style={styles.filters}>
        <ChipRow
          options={[{ value: "all", label: "전체" }, ...categories.map((c) => ({ value: c.key, label: c.name }))]}
          selected={category}
          onSelect={setCategory}
        />
        <ChipRow options={DURATION_OPTIONS} selected={duration} onSelect={setDuration} />
        <ChipRow options={SCOPE_OPTIONS} selected={scope} onSelect={setScope} />
        <ChipRow options={SORT_OPTIONS} selected={sort} onSelect={setSort} />
      </View>

      <View style={styles.countRow}>
        <Text style={styles.count}>{surveys === null ? "" : `설문 ${visible.length}개`}</Text>
        <Button title="+ 설문 등록" variant="soft" small onPress={() => router.push("/create")} />
      </View>

      {surveys === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : visible.length === 0 ? (
        <EmptyState title="조건에 맞는 설문이 없어요" message="필터를 바꿔 보세요." />
      ) : (
        visible.map((s) => <SurveyListCard key={s.id} survey={s} />)
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
        <Chip key={o.value} label={o.label} selected={selected === o.value} onPress={() => onSelect(o.value)} />
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
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  loading: {
    marginTop: spacing.lg,
  },
  filters: {
    gap: spacing.sm,
  },
  chipRow: {
    gap: spacing.sm,
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  count: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.textMuted,
  },
});
