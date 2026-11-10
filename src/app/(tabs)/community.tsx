// ys-140 커뮤니티 · F-601 (맨 위 배너: 오늘의 질문 + 이미지 배너 2026-11-10 · 🔥 HOT 롤링(펼치면 HOT TOP·학교 대항전) + 글: 밸런스 · 나만 그래? · 골라 줘 · 설문 홍보)
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import CommunityBanner from "@/components/community/CommunityBanner";
import PostCard from "@/components/community/PostCard";
import TrendingTicker from "@/components/community/TrendingTicker";
import WorldcupCard from "@/components/community/WorldcupCard";
import EmptyState from "@/components/ui/EmptyState";
import Fab from "@/components/ui/Fab";
import SelectButton from "@/components/ui/SelectButton";
import TextTabs from "@/components/ui/TextTabs";
import { colors, spacing } from "@/constants/theme";
import { fetchHot, type HotItem, POST_SORT_OPTIONS, type Post, type PostSort } from "@/lib/community";
import { supabase } from "@/lib/supabase";
import type { WorldcupItem } from "@/lib/worldcup";

// 분류 4개 (2026-11-09 팀 피드백: 6개는 많아 보임). 투표 = 밸런스·나만 그래?·골라 줘 (종류는 글 쓸 때 고르고 카드에 표시)
// 월드컵은 글이 아니라 따로 불러온다
type KindFilter = "all" | "vote" | "worldcup" | "promo";

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "vote", label: "투표" },
  { value: "worldcup", label: "월드컵" },
  { value: "promo", label: "설문 홍보" },
];

// HOT은 탭에 있을 때만 30초마다 새로
const HOT_REFRESH_MS = 30000;

export default function Community() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [worldcups, setWorldcups] = useState<WorldcupItem[] | null>(null);
  const [kind, setKind] = useState<KindFilter>("all");
  // 기본은 최신순 (2026-11-10 피드백: 글이 적은 초기엔 새 글이 먼저 보이는 게 자연스러움)
  const [sort, setSort] = useState<PostSort>("latest");
  const [hot, setHot] = useState<HotItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  // 당겨서 새로고침할 때 배너(오늘의 질문)도 다시 불러오게 (key가 바뀌면 새로 그림)
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (kind === "worldcup") {
      const { data } = await supabase.rpc("get_worldcups");
      setWorldcups((data as WorldcupItem[] | null) ?? []);
      return;
    }
    // 투표는 세 종류를 한 번에 불러와 설문 홍보만 뺀다
    const { data } = await supabase.rpc("get_feed", { p_kind: kind === "promo" ? "promo" : null, p_sort: sort });
    const list = (data as Post[] | null) ?? [];
    setPosts(kind === "vote" ? list.filter((p) => p.kind !== "promo") : list);
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
        {/* 맨 위 배너 (화면 양 끝까지): 1장 오늘의 질문 → 이미지 배너. 누르면 오늘의 질문 / 그 탭으로 (2026-11-10 피그마) */}
        <View style={styles.banner}>
          <CommunityBanner
            key={refreshKey}
            onOpenDaily={() => router.push("/community/daily")}
            onSelect={setKind}
          />
        </View>
        {/* "전체"일 때만: 🔥 HOT 롤링 한 줄 (오늘의 질문 작은 카드는 2026-11-10 배너 1장으로 옮김) */}
        {kind === "all" && <TrendingTicker items={hot} />}

        {/* 종류: 글자 탭 / 정렬: 선택 버튼 (2026-11-02 정리) */}
        <TextTabs options={KIND_FILTERS} value={kind} onChange={setKind} fill />
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
          <EmptyState
            title={kind === "promo" ? "아직 설문 홍보 글이 없어요" : kind === "vote" ? "아직 투표가 없어요" : "아직 글이 없어요"}
            message={kind === "promo" ? "내 설문을 홍보해 응답을 더 모아 보세요!" : "첫 투표를 만들어 보세요!"}
            emoji={kind === "promo" ? "📣" : "🗳️"}
          />
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
  // 바깥 여백만큼 당겨서 화면 양 끝·제목줄 바로 아래에 붙인다
  banner: {
    marginHorizontal: -spacing.md,
    marginTop: -spacing.md,
  },
  filters: {
    flexDirection: "row",
  },
  loading: {
    marginTop: spacing.lg,
  },
});
