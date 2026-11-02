// ys-110 설문 목록 · F-202~204
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import SurveyListCard from "@/components/SurveyListCard";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import EmptyState from "@/components/ui/EmptyState";
import SelectButton from "@/components/ui/SelectButton";
import { Text } from "@/components/ui/Text";
import TextTabs from "@/components/ui/TextTabs";
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
  { value: "le3", label: "3분 이내" },
  { value: "3to7", label: "3~7분" },
  { value: "7to15", label: "7~15분" },
  { value: "gte15", label: "15분 이상" },
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
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    supabase
      .from("survey_categories")
      .select("key, name")
      .order("sort_order")
      .then(({ data }) => setCategories(data ?? []));
    setSurveys(await fetchOpenSurveys());
  }, []);

  // 탭에 돌아올 때마다 새로 불러온다 (응답한 설문이 바로 빠지게)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // 아래로 당겨서 새로고침 (2026-11-03)
  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

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
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />
      }
    >
      {/* 카테고리: 글자 탭 / 정렬 · 소요시간 · 우리 학교만: 한 줄 (2026-11-02 정리) */}
      <TextTabs
        options={[{ value: "all", label: "전체" }, ...categories.map((c) => ({ value: c.key, label: c.name }))]}
        value={category}
        onChange={setCategory}
      />
      <View style={styles.filters}>
        <SelectButton title="정렬" options={SORT_OPTIONS} value={sort} onChange={setSort} />
        <SelectButton
          title="소요시간"
          options={DURATION_OPTIONS}
          value={duration}
          onChange={setDuration}
          defaultValue="all"
          placeholder="소요시간"
        />
        <Chip
          label="우리 학교만"
          selected={scope === "campus"}
          onPress={() => setScope(scope === "campus" ? "all" : "campus")}
        />
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
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
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
