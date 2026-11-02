// ys-140 커뮤니티 · F-601 (작은 오늘의 질문 · 🔥 HOT 롤링(펼치면 HOT TOP·학교 대항전) + 글: 밸런스 · 나만 그래? · 골라 줘 · 설문 홍보)
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import PostCard from "@/components/community/PostCard";
import TrendingTicker from "@/components/community/TrendingTicker";
import WorldcupCard from "@/components/community/WorldcupCard";
import DailyCard from "@/components/DailyCard";
import EmptyState from "@/components/ui/EmptyState";
import Fab from "@/components/ui/Fab";
import SelectButton from "@/components/ui/SelectButton";
import TextTabs from "@/components/ui/TextTabs";
import { colors, spacing } from "@/constants/theme";
import { fetchHot, type HotItem, KIND_LABELS, POST_SORT_OPTIONS, type Post, type PostKind, type PostSort } from "@/lib/community";
import { supabase } from "@/lib/supabase";
import type { WorldcupItem } from "@/lib/worldcup";

// 글 종류 + 월드컵 (월드컵은 글이 아니라 따로 불러온다)
type KindFilter = "all" | PostKind | "worldcup";

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "worldcup", label: "월드컵" },
  ...(Object.keys(KIND_LABELS) as PostKind[]).map((k) => ({ value: k as KindFilter, label: KIND_LABELS[k] })),
];

// HOT은 탭에 있을 때만 30초마다 새로
const HOT_REFRESH_MS = 30000;

export default function Community() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [worldcups, setWorldcups] = useState<WorldcupItem[] | null>(null);
  const [kind, setKind] = useState<KindFilter>("all");
  const [sort, setSort] = useState<PostSort>("popular");
  const [hot, setHot] = useState<HotItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  // 당겨서 새로고침할 때 오늘의 질문 카드도 다시 불러오게 (key가 바뀌면 새로 그림)
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (kind === "worldcup") {
      const { data } = await supabase.rpc("get_worldcups");
      setWorldcups((data as WorldcupItem[] | null) ?? []);
      return;
    }
    const { data } = await supabase.rpc("get_feed", { p_kind: kind === "all" ? null : kind, p_sort: sort });
    setPosts((data as Post[] | null) ?? []);
  }, [kind, sort]);

  // HOT 목록 (롤링 줄·펼친 목록·카드 뱃지가 같이 쓴다). 오류면 조용히 숨김 (보조 정보라서)
  const loadHot = useCallback(
    () =>
      fetchHot()
        .then(setHot)
        .catch(() => setHot([])),
    [],
  );

  // 탭에 돌아올 때·필터를 바꿀 때마다 새로 불러온다
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useFocusEffect(
    useCallback(() => {
      loadHot();
      const timer = setInterval(loadHot, HOT_REFRESH_MS);
      return () => clearInterval(timer);
    }, [loadHot]),
  );

  // 아래로 당겨서 새로고침
  const refresh = async () => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    await Promise.all([load(), loadHot()]);
    setRefreshing(false);
  };

  // 목록 카드에 🔥 HOT 뱃지를 달 글·월드컵
  const hotIds = useMemo(() => new Set(hot.map((h) => `${h.type}-${h.id}`)), [hot]);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* "전체"일 때만: 작은 오늘의 질문(누르면 그룹별 결과·댓글) + 🔥 HOT 롤링 한 줄 (2026-11-03 정리) */}
        {kind === "all" && <DailyCard key={refreshKey} compact onOpen={() => router.push("/community/daily")} />}
        {kind === "all" && <TrendingTicker items={hot} />}

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
            worldcups.map((w) => <WorldcupCard key={w.id} item={w} hot={hotIds.has(`worldcup-${w.id}`)} />)
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
              hot={hotIds.has(`post-${p.id}`)}
              onVoted={load}
              onOpen={() => router.push({ pathname: "/community/[id]", params: { id: String(p.id) } })}
            />
          ))
        )}
      </ScrollView>

      {/* 글 만들기: 오른쪽 아래 둥근 버튼 */}
      <Fab onPress={() => router.push("/community/new")} accessibilityLabel="글 만들기" />
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
    // 둥근 만들기 버튼에 마지막 글이 가리지 않게
    paddingBottom: 96,
  },
  filters: {
    flexDirection: "row",
  },
  loading: {
    marginTop: spacing.lg,
  },
});
