// ys-130 데이터 목록 · F-501
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import Chips from "@/components/create/Chips";
import { colors, fontSize, spacing } from "@/constants/theme";
import { formatDate } from "@/lib/format";
import { HUB_SORT_OPTIONS, type HubItem, type HubSort } from "@/lib/hub";
import { supabase } from "@/lib/supabase";
import { formatHost } from "@/lib/surveys";

type Category = { key: string; name: string };

export default function Data() {
  const [items, setItems] = useState<HubItem[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<HubSort>("popular");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // 탭에 돌아올 때·필터를 바꿀 때마다 새로 불러온다 (열람함 표시가 바로 바뀌게)
  useFocusEffect(
    useCallback(() => {
      supabase
        .rpc("get_hub_list", { p_category: category === "all" ? null : category, p_sort: sort })
        .then(({ data }) => setItems((data as HubItem[] | null) ?? []));
      supabase
        .from("survey_categories")
        .select("key, name")
        .order("sort_order")
        .then(({ data }) => setCategories(data ?? []));
    }, [category, sort]),
  );

  const open = (id: number) => router.push({ pathname: "/data/[id]", params: { id: String(id) } });
  // 내가 응답한 설문 결과 (내 답 비교는 무료)
  const answered = (items ?? []).filter((i) => i.answered);
  // 인증 단체(학생회·연구실 등 운영자가 승인한 단체) 결과만
  const shown = (items ?? []).filter((i) => !verifiedOnly || i.host_verified);

  return (
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
      {answered.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>내가 응답한 설문 결과</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {answered.map((i) => (
              <Pressable key={i.id} style={styles.stripCard} onPress={() => open(i.id)}>
                <Text style={styles.stripTitle} numberOfLines={2}>
                  {i.title}
                </Text>
                <Text style={styles.meta}>{i.viewed ? "결과 보기 ›" : "내 답 비교 보기 ›"}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <Chips
        options={[{ value: "all", label: "전체" }, ...categories.map((c) => ({ value: c.key, label: c.name }))]}
        selected={category}
        onSelect={setCategory}
      />
      <Chips options={HUB_SORT_OPTIONS} selected={sort} onSelect={setSort} />
      <Pressable
        style={[styles.toggle, verifiedOnly && styles.toggleOn]}
        onPress={() => setVerifiedOnly(!verifiedOnly)}
      >
        <Text style={[styles.toggleText, verifiedOnly && styles.toggleTextOn]}>✓ 인증 단체만</Text>
      </Pressable>

      {items === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : shown.length === 0 ? (
        <Text style={styles.empty}>
          {verifiedOnly
            ? "아직 인증 단체가 공개한 결과가 없어요."
            : "아직 공개된 결과가 없어요.\n설문이 마감되고 응답이 모이면 여기에 올라와요."}
        </Text>
      ) : (
        shown.map((i) => (
          <Pressable key={i.id} style={styles.card} onPress={() => open(i.id)}>
            <View style={styles.badges}>
              <Text style={styles.meta}>
                {formatHost(i)} · {i.category_name}
              </Text>
              {i.trusted && <Text style={styles.trusted}>신뢰도 높음</Text>}
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {i.title}
            </Text>
            <View style={styles.cardBottom}>
              <Text style={styles.meta}>
                응답 {i.response_count} · 열람 {i.view_count} · {formatDate(i.ended_at)} 마감
              </Text>
              {i.viewed ? (
                <Text style={styles.viewed}>✓ 열람 완료</Text>
              ) : i.free ? (
                <Text style={styles.free}>무료</Text>
              ) : null}
            </View>
          </Pressable>
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
    gap: spacing.sm,
  },
  loading: {
    marginTop: spacing.lg,
  },
  empty: {
    marginTop: spacing.lg,
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: "center",
  },
  section: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  strip: {
    gap: spacing.sm,
  },
  stripCard: {
    width: 180,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    gap: spacing.sm,
  },
  stripTitle: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.text,
  },
  card: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    gap: 6,
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
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
  trusted: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.primary,
  },
  free: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.primary,
  },
  toggle: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  toggleOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: fontSize.small,
    color: colors.text,
  },
  toggleTextOn: {
    color: colors.background,
    fontWeight: "700",
  },
  viewed: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
});
