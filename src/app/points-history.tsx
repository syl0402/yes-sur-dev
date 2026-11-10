// ys-159 포인트 내역 전체 · F-701 (마이 탭 "전체 내역 보기"에서. [전체 | 적립 | 사용] · 아래로 내리면 더 불러오기, 2026-11-10)
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, StyleSheet, View } from "react-native";

import LedgerList from "@/components/LedgerList";
import EmptyState from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import TextTabs from "@/components/ui/TextTabs";
import { colors, fontSize, spacing } from "@/constants/theme";
import { fetchLedger, type LedgerItem, type LedgerKind } from "@/lib/ledger";

// 한 번에 불러오는 개수
const PAGE = 30;

const KINDS: { value: LedgerKind; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "earn", label: "적립" },
  { value: "spend", label: "사용" },
];

const EMPTY: Record<LedgerKind, string> = {
  all: "아직 포인트 내역이 없어요",
  earn: "아직 적립한 내역이 없어요",
  spend: "아직 사용한 내역이 없어요",
};

export default function PointsHistory() {
  const [kind, setKind] = useState<LedgerKind>("all");
  const [items, setItems] = useState<LedgerItem[] | null>(null);
  const [done, setDone] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // 탭을 빠르게 바꿨을 때 늦게 온 결과가 덮어쓰지 않게
  const requestId = useRef(0);

  const loadFirst = useCallback((k: LedgerKind) => {
    const id = ++requestId.current;
    setItems(null);
    setDone(false);
    fetchLedger({ limit: PAGE, kind: k }).then((rows) => {
      if (id !== requestId.current) return;
      setItems(rows);
      setDone(rows.length < PAGE);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFirst(kind);
    }, [loadFirst, kind]),
  );

  const loadMore = async () => {
    if (items === null || done || loadingMore) return;
    setLoadingMore(true);
    const id = requestId.current;
    const rows = await fetchLedger({ offset: items.length, limit: PAGE, kind });
    setLoadingMore(false);
    if (id !== requestId.current) return;
    setItems([...items, ...rows]);
    setDone(rows.length < PAGE);
  };

  // 바닥에서 300px 안으로 내려오면 다음 묶음을 불러온다
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 300) loadMore();
  };

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
      onScroll={onScroll}
      scrollEventThrottle={200}
    >
      <Stack.Screen options={{ title: "포인트 내역" }} />
      <TextTabs options={KINDS} value={kind} onChange={setKind} fill />

      {items === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : items.length === 0 ? (
        <EmptyState title={EMPTY[kind]} message="설문에 답하거나 오늘의 질문에 참여하면 쌓여요." emoji="🪙" />
      ) : (
        <>
          <LedgerList items={items} />
          <View style={styles.footer}>
            {loadingMore ? (
              <ActivityIndicator color={colors.primary} />
            ) : done ? (
              <Text style={styles.end}>내역을 모두 불러왔어요</Text>
            ) : null}
          </View>
        </>
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
    padding: 20,
    paddingBottom: spacing.xl,
    gap: 20,
  },
  loading: {
    marginTop: spacing.lg,
  },
  footer: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  end: {
    fontSize: fontSize.caption,
    color: colors.textSubtle,
  },
});
