// ys-140 커뮤니티 · F-601 (오늘의 질문 카드 + 투표 3종: 밸런스 · 나만 그래? · 골라 줘)
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import PostCard from "@/components/community/PostCard";
import Chips from "@/components/create/Chips";
import DailyCard from "@/components/DailyCard";
import { colors, fontSize, spacing } from "@/constants/theme";
import { KIND_LABELS, POST_SORT_OPTIONS, type Post, type PostKind, type PostSort } from "@/lib/community";
import { supabase } from "@/lib/supabase";

type KindFilter = "all" | PostKind;

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "전체" },
  ...(Object.keys(KIND_LABELS) as PostKind[]).map((k) => ({ value: k as KindFilter, label: KIND_LABELS[k] })),
];

export default function Community() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [kind, setKind] = useState<KindFilter>("all");
  const [sort, setSort] = useState<PostSort>("popular");

  const load = useCallback(() => {
    supabase
      .rpc("get_feed", { p_kind: kind === "all" ? null : kind, p_sort: sort })
      .then(({ data }) => setPosts((data as Post[] | null) ?? []));
  }, [kind, sort]);

  // 탭에 돌아올 때·필터를 바꿀 때마다 새로 불러온다
  useFocusEffect(load);

  return (
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
      <View style={styles.top}>
        <Text style={styles.lead}>대학생들은 어떻게 생각할까? 투표하고 비율을 확인해 보세요.</Text>
        <Pressable style={styles.newButton} onPress={() => router.push("/community/new")}>
          <Text style={styles.newText}>+ 만들기</Text>
        </Pressable>
      </View>

      {/* 오늘의 질문 (홈과 같은 카드, "전체"일 때만). 누르면 그룹별 결과·댓글 */}
      {kind === "all" && <DailyCard onOpen={() => router.push("/community/daily")} />}

      <Chips options={KIND_FILTERS} selected={kind} onSelect={setKind} />
      <Chips options={POST_SORT_OPTIONS} selected={sort} onSelect={setSort} />

      {posts === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : posts.length === 0 ? (
        <Text style={styles.empty}>아직 글이 없어요.{"\n"}첫 투표를 만들어 보세요!</Text>
      ) : (
        posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            onVoted={load}
            onOpen={() => router.push({ pathname: "/community/[id]", params: { id: String(p.id) } })}
          />
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
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  lead: {
    flex: 1,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  newButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  newText: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.background,
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
});
