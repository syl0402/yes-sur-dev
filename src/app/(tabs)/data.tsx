// ys-130 데이터 목록 · F-501 (2026-11-01: 검색 · 스크랩 · 카드 정리)
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import TagRow from "@/components/TagRow";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import EmptyState from "@/components/ui/EmptyState";
import SelectButton from "@/components/ui/SelectButton";
import { Text, TextInput } from "@/components/ui/Text";
import TextTabs from "@/components/ui/TextTabs";
import { bookmarkIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatDate } from "@/lib/format";
import { HUB_SORT_OPTIONS, type HubItem, type HubSort } from "@/lib/hub";
import { fetchRules } from "@/lib/rules";
import { supabase } from "@/lib/supabase";
import { formatHost } from "@/lib/surveys";
import { addTag, formatTag, matchesTags, type Tag } from "@/lib/tags";

type Category = { key: string; name: string };

export default function Data() {
  const [items, setItems] = useState<HubItem[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<HubSort>("popular");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [search, setSearch] = useState("");
  // 카드의 #태그를 누를 때마다 필터에 더한다 (모두 붙은 결과만, 2026-11-07)
  const [pickedTags, setPickedTags] = useState<Tag[]>([]);
  // 내가 스크랩한 설문 번호
  const [saved, setSaved] = useState<number[]>([]);
  // 데이터 허브에 올라가는 최소 응답 수 (빈 화면 안내용, point_rules)
  const [minCount, setMinCount] = useState<number | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    supabase.rpc("get_my_bookmarks").then(({ data }) => setSaved((data as number[] | null) ?? []));
    supabase
      .from("survey_categories")
      .select("key, name")
      .order("sort_order")
      .then(({ data }) => setCategories(data ?? []));
    fetchRules(["result_min_count"]).then((r) => setMinCount(r.result_min_count ?? null));
    const { data } = await supabase.rpc("get_hub_list", { p_category: category === "all" ? null : category, p_sort: sort });
    setItems((data as HubItem[] | null) ?? []);
  }, [category, sort]);

  // 탭에 돌아올 때·필터를 바꿀 때마다 새로 불러온다 (열람함·스크랩 표시가 바로 바뀌게)
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

  const open = (id: number) => router.push({ pathname: "/data/[id]", params: { id: String(id) } });
  // 내가 응답한 설문 결과 (내 답 비교는 무료)
  const answered = (items ?? []).filter((i) => i.answered);
  const q = search.trim();
  const filtering = q !== "" || verifiedOnly || savedOnly || pickedTags.length > 0;
  const shown = (items ?? []).filter(
    (i) =>
      (!verifiedOnly || i.host_verified) &&
      (!savedOnly || saved.includes(i.id)) &&
      (q === "" || i.title.toLowerCase().includes(q.toLowerCase())) &&
      matchesTags(i.tags ?? [], pickedTags),
  );

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />
      }
    >
      {/* 검색 (제목) */}
      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="🔍 궁금한 주제를 찾아보세요 (예: 아르바이트)"
        returnKeyType="search"
        autoCorrect={false}
      />

      {answered.length > 0 && q === "" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>내가 응답한 설문 결과</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {answered.map((i) => (
              <Card key={i.id} style={styles.stripCard} onPress={() => open(i.id)}>
                <Text style={styles.stripTitle} numberOfLines={2}>
                  {i.title}
                </Text>
                <Text style={styles.stripLink}>{i.viewed ? "결과 보기 ›" : "내 답 비교 보기 ›"}</Text>
              </Card>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 카테고리: 글자 탭 / 정렬 · 인증 단체 · 스크랩: 한 줄 (2026-11-02 정리) */}
      <TextTabs
        options={[{ value: "all", label: "전체" }, ...categories.map((c) => ({ value: c.key, label: c.name }))]}
        value={category}
        onChange={setCategory}
      />
      <View style={styles.filters}>
        <SelectButton title="정렬" options={HUB_SORT_OPTIONS} value={sort} onChange={setSort} />
        <Chip label="✓ 인증 단체" selected={verifiedOnly} onPress={() => setVerifiedOnly(!verifiedOnly)} />
        <Chip icon={bookmarkIcons.on} label={`스크랩 ${saved.length}`} selected={savedOnly} onPress={() => setSavedOnly(!savedOnly)} />
      </View>
      {pickedTags.length > 0 && (
        <View style={styles.filters}>
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

      {items === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : shown.length === 0 ? (
        filtering ? (
          <EmptyState {...emptyFilterMessage(savedOnly, verifiedOnly, pickedTags.length > 0, q !== "")} />
        ) : (
          <View style={styles.emptyBox}>
            <EmptyState
              title="아직 공개된 결과가 없어요"
              message={`설문이 마감되고 응답이 ${minCount !== null ? `${minCount}개 이상 ` : ""}모이면 여기에 결과가 올라와요.\n지금 열린 설문에 응답하면 내 답도 결과에 들어가요.`}
              emoji="📊"
            />
            <PrimaryButton title="응답하러 가기" onPress={() => router.navigate("/surveys")} />
          </View>
        )
      ) : (
        shown.map((i) => (
          <Card key={i.id} onPress={() => open(i.id)}>
            <View style={styles.cardTop}>
              <View style={styles.badges}>
                <Badge label={i.category_name} />
                {i.trusted && <Badge label="✓ 신뢰도 높음" tone="accent" />}
              </View>
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {i.title}
            </Text>
            <TagRow tags={i.tags ?? []} onPress={(t) => setPickedTags(addTag(pickedTags, t))} />
            <View style={styles.cardBottom}>
              <Text style={styles.meta} numberOfLines={1}>
                {formatHost(i)} · 응답 {i.response_count} · 열람 {i.view_count} · {formatDate(i.ended_at)}
              </Text>
              {i.mine ? (
                <Badge label="내 설문" tone="primary" />
              ) : i.viewed ? (
                <Badge label="열람함" tone="muted" />
              ) : i.free ? (
                <Badge label="무료" tone="accent" />
              ) : null}
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

// 필터를 걸었는데 결과가 없을 때: 어떤 필터인지에 맞춰 안내 (2026-11-09 팀 피드백: 숨기지 말고 상황 안내)
function emptyFilterMessage(saved: boolean, verified: boolean, tagged: boolean, searched: boolean) {
  if (saved) return { title: "스크랩한 결과가 없어요", message: "결과 화면 오른쪽 위 책갈피를 누르면 여기에 모아 볼 수 있어요.", emoji: "🔖" };
  if (searched) return { title: "검색 결과가 없어요", message: "다른 단어로 검색해 보세요.", emoji: "🔍" };
  if (verified && !tagged)
    return {
      title: "아직 인증 단체 설문 결과가 없어요",
      message: "인증 단체가 올린 설문이 마감되면 여기에서 볼 수 있어요.",
      emoji: "🏫",
    };
  if (tagged) return { title: "이 태그가 붙은 결과가 아직 없어요", message: "다른 태그로 찾아보세요.", emoji: "🏷️" };
  return { title: "조건에 맞는 결과가 없어요", message: "필터를 바꿔 보세요.", emoji: "🔍" };
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
  search: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    fontSize: fontSize.body,
    color: colors.text,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  // 카드 높이를 가장 긴 제목에 맞춘다 (2026-11-09 피드백)
  row: {
    gap: spacing.sm,
    alignItems: "stretch",
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  stripCard: {
    width: 180,
    justifyContent: "space-between",
    borderColor: colors.primarySoft,
  },
  stripTitle: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.text,
  },
  stripLink: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.primary,
  },
  emptyBox: {
    gap: spacing.md,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badges: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  title: {
    fontSize: fontSize.subtitle,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 25,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  meta: {
    flex: 1,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
});
