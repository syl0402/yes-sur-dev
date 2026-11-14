// ys-159 포인트 내역 전체 · F-701 (마이 탭 "전체 내역 보기"에서. [전체 | 적립 | 사용] · 아래로 내리면 더 불러오기, 2026-11-10)
// 2026-11-14 마이 탭 시안 ③: 위에 지금 포인트 + 이번 달 모은·쓴, 맨 아래 "포인트는 어떻게 모으나요?"
import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, StyleSheet, View } from "react-native";

import LedgerList from "@/components/LedgerList";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import TextTabs from "@/components/ui/TextTabs";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { fetchLedger, fetchMonthSummary, type LedgerItem, type LedgerKind } from "@/lib/ledger";
import { supabase } from "@/lib/supabase";

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
  // 위 요약: 지금 포인트 · 이번 달 모은 · 쓴
  const [summary, setSummary] = useState<{ balance: number; earned: number; spent: number } | null>(null);
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
  useFocusEffect(
    useCallback(() => {
      Promise.all([supabase.rpc("get_my_balance"), fetchMonthSummary()]).then(([{ data }, m]) =>
        setSummary({ balance: typeof data === "number" ? data : 0, ...m }),
      );
    }, []),
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

      {/* 지금 포인트 + 이번 달 모은 · 쓴 */}
      {summary && (
        <Card>
          <Text style={styles.label}>지금 내 포인트</Text>
          <Text style={styles.balance}>{formatPoints(summary.balance)}</Text>
          <View style={styles.month}>
            <View style={[styles.monthBox, styles.monthEarn]}>
              <Text style={styles.label}>이번 달 모은</Text>
              <Text style={[styles.monthValue, styles.monthEarnValue]}>+{formatPoints(summary.earned)}</Text>
            </View>
            <View style={[styles.monthBox, styles.monthSpend]}>
              <Text style={styles.label}>이번 달 쓴</Text>
              <Text style={styles.monthValue}>-{formatPoints(summary.spent)}</Text>
            </View>
          </View>
        </Card>
      )}

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
          {done && <Button title="포인트는 어떻게 모으나요?" variant="soft" onPress={() => router.push("/points")} />}
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
  label: {
    fontSize: fontSize.caption,
    color: colors.iconStrong,
  },
  balance: {
    fontSize: fontSize.hero,
    fontWeight: "800",
    color: colors.text,
  },
  month: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  monthBox: {
    flex: 1,
    gap: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  monthEarn: {
    backgroundColor: colors.primaryFaint,
  },
  monthSpend: {
    backgroundColor: colors.surfaceSubtle,
  },
  monthValue: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  monthEarnValue: {
    color: colors.primaryStrong,
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
