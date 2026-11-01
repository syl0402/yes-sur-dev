// ys-130 데이터 목록 · F-501 (2026-11-01: 검색 · 저장한 결과 · 카드 정리)
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import EmptyState from "@/components/ui/EmptyState";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatDate } from "@/lib/format";
import { HUB_SORT_OPTIONS, type HubItem, type HubSort } from "@/lib/hub";
import { fetchRules } from "@/lib/rules";
import { supabase } from "@/lib/supabase";
import { formatHost } from "@/lib/surveys";

type Category = { key: string; name: string };

export default function Data() {
  const [items, setItems] = useState<HubItem[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<HubSort>("popular");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [search, setSearch] = useState("");
  // 내가 저장한 설문 번호
  const [saved, setSaved] = useState<number[]>([]);
  // 데이터 허브에 올라가는 최소 응답 수 (빈 화면 안내용, point_rules)
  const [minCount, setMinCount] = useState<number | null>(null);

  // 탭에 돌아올 때·필터를 바꿀 때마다 새로 불러온다 (열람함·저장 표시가 바로 바뀌게)
  useFocusEffect(
    useCallback(() => {
      supabase
        .rpc("get_hub_list", { p_category: category === "all" ? null : category, p_sort: sort })
        .then(({ data }) => setItems((data as HubItem[] | null) ?? []));
      supabase.rpc("get_my_bookmarks").then(({ data }) => setSaved((data as number[] | null) ?? []));
      supabase
        .from("survey_categories")
        .select("key, name")
        .order("sort_order")
        .then(({ data }) => setCategories(data ?? []));
      fetchRules(["result_min_count"]).then((r) => setMinCount(r.result_min_count ?? null));
    }, [category, sort]),
  );

  const open = (id: number) => router.push({ pathname: "/data/[id]", params: { id: String(id) } });
  // 내가 응답한 설문 결과 (내 답 비교는 무료)
  const answered = (items ?? []).filter((i) => i.answered);
  const q = search.trim();
  const filtering = q !== "" || verifiedOnly || savedOnly;
  const shown = (items ?? []).filter(
    (i) =>
      (!verifiedOnly || i.host_verified) &&
      (!savedOnly || saved.includes(i.id)) &&
      (q === "" || i.title.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
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

      {/* 필터: 카테고리 / 정렬 · 인증 단체 · 저장한 결과 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Chip label="전체" selected={category === "all"} onPress={() => setCategory("all")} />
        {categories.map((c) => (
          <Chip key={c.key} label={c.name} selected={category === c.key} onPress={() => setCategory(c.key)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {HUB_SORT_OPTIONS.map((o) => (
          <Chip key={o.value} label={o.label} selected={sort === o.value} onPress={() => setSort(o.value)} />
        ))}
        <View style={styles.sep} />
        <Chip label="✓ 인증 단체" selected={verifiedOnly} onPress={() => setVerifiedOnly(!verifiedOnly)} />
        <Chip label={`★ 저장 ${saved.length}`} selected={savedOnly} onPress={() => setSavedOnly(!savedOnly)} />
      </ScrollView>

      {items === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : shown.length === 0 ? (
        filtering ? (
          <EmptyState
            title={savedOnly ? "저장한 결과가 없어요" : "찾는 결과가 없어요"}
            message={savedOnly ? "결과 화면 오른쪽 위 ☆를 누르면 여기에 모여요." : "다른 말로 찾거나 필터를 바꿔 보세요."}
            emoji={savedOnly ? "⭐" : "🔍"}
          />
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
              {saved.includes(i.id) && <Text style={styles.star}>★</Text>}
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {i.title}
            </Text>
            <View style={styles.cardBottom}>
              <Text style={styles.meta} numberOfLines={1}>
                {formatHost(i)} · 응답 {i.response_count} · 열람 {i.view_count} · {formatDate(i.ended_at)}
              </Text>
              {i.viewed ? (
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
  row: {
    gap: spacing.sm,
    alignItems: "center",
  },
  sep: {
    width: 1,
    height: 20,
    backgroundColor: colors.border,
  },
  stripCard: {
    width: 180,
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
  star: {
    fontSize: fontSize.subtitle,
    color: colors.primary,
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
