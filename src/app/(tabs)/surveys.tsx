// ys-110 설문 목록 · F-202~204
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import SurveyListCard from "@/components/SurveyListCard";
import Chip from "@/components/ui/Chip";
import EmptyState from "@/components/ui/EmptyState";
import Fab from "@/components/ui/Fab";
import SelectButton from "@/components/ui/SelectButton";
import { Text, TextInput } from "@/components/ui/Text";
import TextTabs from "@/components/ui/TextTabs";
import { uiIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { addTag, decodeTags, encodeTags, formatTag, matchesTags, type Tag } from "@/lib/tags";
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
  { value: "reward", label: "포인트 높은 순" },
];

export default function Surveys() {
  const [surveys, setSurveys] = useState<SurveyCard[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState("all");
  const [duration, setDuration] = useState<DurationKey>("all");
  const [scope, setScope] = useState<Scope>("all");
  // 보상 이벤트 있는 설문만 (2026-11-07)
  const [rewardOnly, setRewardOnly] = useState(false);
  // 내가 올린 진행 중 설문만 (2026-11-09 개인 피드백 11번)
  const [mineOnly, setMineOnly] = useState(false);
  // 검색: 제목 또는 #태그 이름에 들어 있으면 (2026-11-10, 데이터 탭과 같은 모양)
  const [search, setSearch] = useState("");
  const q = search.trim().replace(/^#/, "").toLowerCase();
  const [sort, setSort] = useState<SortKey>("recommended");
  // 카드의 #태그를 누를 때마다 필터에 더한다 (모두 붙은 설문만). 주소의 ?tags= 가 곧 필터 (홈 카드에서 와도 같게)
  const params = useLocalSearchParams<{ tags?: string; q?: string; category?: string }>();
  // 홈 "빠른 탐색"에서 카테고리를 누르고 오면 그 카테고리로 (2026-11-10). 받은 뒤 주소에서 지워 다음에 탭을 눌러도 다시 걸리지 않게
  const [seenCategory, setSeenCategory] = useState<string | undefined>(undefined);
  if (params.category !== seenCategory) {
    setSeenCategory(params.category);
    if (params.category) setCategory(params.category);
  }
  useEffect(() => {
    if (params.category) router.setParams({ category: undefined });
  }, [params.category]);
  // 통합 검색 "설문 탭에서 더 보기"로 오면 검색칸에 같은 단어 (2026-11-10)
  const [seenQ, setSeenQ] = useState<string | undefined>(undefined);
  if (params.q !== seenQ) {
    setSeenQ(params.q);
    if (params.q) setSearch(params.q);
  }
  useEffect(() => {
    if (params.q) router.setParams({ q: undefined });
  }, [params.q]);
  const pickedTags = decodeTags(params.tags);
  const setPickedTags = (next: Tag[]) => router.setParams({ tags: encodeTags(next) });
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
              (scope === "all" || s.from_my_school) &&
              matchesTags(s.tags, pickedTags) &&
              (!rewardOnly || s.has_reward) &&
              (!mineOnly || s.mine) &&
              (q === "" || s.title.toLowerCase().includes(q) || s.tags.some((t) => t.name.toLowerCase().includes(q))),
          ),
          sort,
        );

  return (
    <View style={styles.screen}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.screen}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* 카테고리: 글자 탭 / 정렬 · 소요시간 · 우리 학교 · 보상 · 내 설문: 한 줄 (2026-11-02 정리, 11-08 우리 학교 = 작성자 학교, 11-09 내 설문) */}
        {/* 검색 (제목 · #태그): 돋보기 아이콘 + 입력칸 */}
        <View style={styles.searchBox}>
          <AppIcon name={uiIcons.search} size={18} color={colors.textSubtle} />
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="설문 제목이나 #태그로 찾아보세요"
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>
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
            label="우리 학교"
            selected={scope === "campus"}
            onPress={() => setScope(scope === "campus" ? "all" : "campus")}
          />
          <Chip icon={uiIcons.gift} label="보상" selected={rewardOnly} onPress={() => setRewardOnly(!rewardOnly)} />
          <Chip label="내 설문" selected={mineOnly} onPress={() => setMineOnly(!mineOnly)} />
        </View>

        {pickedTags.length > 0 && (
          <View style={styles.tagFilter}>
            {pickedTags.map((t) => (
              <Chip
                key={t.id}
                label={`${formatTag(t.name)}  ✕`}
                selected
                onPress={() => setPickedTags(pickedTags.filter((p) => p.id !== t.id))}
              />
            ))}
          </View>
        )}

        <View style={styles.countRow}>
          <Text style={styles.count}>{surveys === null ? "" : `설문 ${visible.length}개`}</Text>
        </View>

        {surveys === null ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : visible.length === 0 ? (
          mineOnly ? (
            // 설문 탭은 진행 중 설문만 보여서, 마감된 내 설문은 마이 탭으로 안내
            <EmptyState
              title="진행 중인 내 설문이 없어요"
              message={"마감된 설문은 마이 탭 \"내 설문 관리\"에서 볼 수 있어요.\n오른쪽 아래 + 버튼으로 새 설문을 올려 보세요."}
              emoji="📣"
            />
          ) : (
            <EmptyState
              title={q !== "" ? "검색 결과가 없어요" : "조건에 맞는 설문이 없어요"}
              message={q !== "" ? "다른 단어로 찾아보거나 필터를 바꿔 보세요." : "필터를 바꿔 보세요."}
            />
          )
        ) : (
          visible.map((s) => <SurveyListCard key={s.id} survey={s} onTagPress={(t) => setPickedTags(addTag(pickedTags, t))} />)
        )}
      </ScrollView>

      {/* 설문 등록: 오른쪽 아래 둥근 버튼, 스크롤해도 고정 (2026-11-07 피드백) */}
      <Fab onPress={() => router.push("/create")} accessibilityLabel="설문 등록" />
    </View>
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
    // 둥근 등록 버튼에 마지막 설문이 가리지 않게
    paddingBottom: 96,
  },
  loading: {
    marginTop: spacing.lg,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  search: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  tagFilter: {
    flexDirection: "row",
    flexWrap: "wrap",
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
