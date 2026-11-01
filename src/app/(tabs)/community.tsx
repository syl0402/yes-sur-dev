// ys-140 커뮤니티 · F-601 (오늘의 질문 · 월드컵 · 주간 베스트 · 계열 대항전 + 글: 밸런스 · 나만 그래? · 골라 줘 · 설문 홍보)
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import MajorRankingCard from "@/components/community/MajorRankingCard";
import PostCard from "@/components/community/PostCard";
import WeeklyBestCard from "@/components/community/WeeklyBestCard";
import WorldcupCard from "@/components/community/WorldcupCard";
import DailyCard from "@/components/DailyCard";
import EmptyState from "@/components/ui/EmptyState";
import SelectButton from "@/components/ui/SelectButton";
import { Text } from "@/components/ui/Text";
import TextTabs from "@/components/ui/TextTabs";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { KIND_LABELS, POST_SORT_OPTIONS, type Post, type PostKind, type PostSort } from "@/lib/community";
import { supabase } from "@/lib/supabase";
import type { WorldcupItem } from "@/lib/worldcup";

// 글 종류 + 월드컵 (월드컵은 글이 아니라 따로 불러온다)
type KindFilter = "all" | PostKind | "worldcup";

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "worldcup", label: "월드컵" },
  ...(Object.keys(KIND_LABELS) as PostKind[]).map((k) => ({ value: k as KindFilter, label: KIND_LABELS[k] })),
];

export default function Community() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [worldcups, setWorldcups] = useState<WorldcupItem[] | null>(null);
  const [kind, setKind] = useState<KindFilter>("all");
  const [sort, setSort] = useState<PostSort>("popular");

  const load = useCallback(() => {
    if (kind === "worldcup") {
      supabase.rpc("get_worldcups").then(({ data }) => setWorldcups((data as WorldcupItem[] | null) ?? []));
      return;
    }
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
      {kind === "all" && <WorldcupCard />}
      {kind === "all" && <WeeklyBestCard />}
      {kind === "all" && <MajorRankingCard />}

      {/* 종류: 글자 탭 / 정렬: 선택 버튼 (2026-11-02 정리) */}
      <TextTabs options={KIND_FILTERS} value={kind} onChange={setKind} />
      {kind !== "worldcup" && (
        <View style={styles.filters}>
          <SelectButton title="정렬" options={POST_SORT_OPTIONS} value={sort} onChange={setSort} />
        </View>
      )}

      {kind === "worldcup" ? (
        worldcups === null ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : worldcups.length === 0 ? (
          <EmptyState title="아직 월드컵이 없어요" message="곧 새 월드컵이 열려요." emoji="🏆" />
        ) : (
          worldcups.map((w) => <WorldcupCard key={w.id} item={w} />)
        )
      ) : posts === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : posts.length === 0 ? (
        <EmptyState title="아직 글이 없어요" message="첫 글을 만들어 보세요!" emoji="🗳️" />
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
    gap: spacing.md,
    paddingBottom: spacing.xl,
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
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  newText: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  filters: {
    flexDirection: "row",
  },
  loading: {
    marginTop: spacing.lg,
  },
});
