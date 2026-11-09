// 마이 탭 "내 데이터": [응답한 | 스크랩 | 열람한] 결과를 한 곳에 (2026-11-09 개인 피드백 14번)
// 새 서버 함수 없음: get_hub_list(내가 응답한 것·스크랩 번호로 거름) · get_my_bookmarks · get_my_views. 모두 본인 것만
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import TextTabs from "@/components/ui/TextTabs";
import { colors, fontSize, spacing } from "@/constants/theme";
import { formatDate, formatPoints } from "@/lib/format";
import type { HubItem } from "@/lib/hub";
import { supabase } from "@/lib/supabase";

type Tab = "answered" | "saved" | "viewed";

// get_my_views 한 줄 (내가 열람한 결과)
type MyView = {
  survey_id: number;
  title: string;
  viewed_at: string;
  paid: number;
};

// 목록 한 줄: 제목 + 회색 설명 (누르면 결과 화면)
type Row = { id: number; title: string; sub: string };

const EMPTY: Record<Tab, { title: string; message: string; emoji: string }> = {
  answered: {
    title: "아직 볼 수 있는 결과가 없어요",
    message: "내가 응답한 설문이 마감되고 결과가 공개되면 여기에 보여요.",
    emoji: "🙋",
  },
  saved: { title: "스크랩한 결과가 없어요", message: "결과 화면 오른쪽 위 책갈피를 누르면 여기에 모여요.", emoji: "🔖" },
  viewed: { title: "열람한 결과가 없어요", message: "데이터 탭에서 다른 설문 결과를 볼 수 있어요.", emoji: "📊" },
};

export default function MyDataPanel() {
  const [tab, setTab] = useState<Tab>("answered");
  const [rows, setRows] = useState<Record<Tab, Row[]> | null>(null);

  // 결과 화면에서 스크랩을 풀고 돌아오면 바로 빠지게 매번 새로 불러온다
  useFocusEffect(
    useCallback(() => {
      Promise.all([
        supabase.rpc("get_hub_list", { p_category: null, p_sort: "latest" }),
        supabase.rpc("get_my_bookmarks"),
        supabase.rpc("get_my_views"),
      ]).then(([hub, marks, views]) => {
        const items = (hub.data as HubItem[] | null) ?? [];
        const saved = (marks.data as number[] | null) ?? [];
        const toRow = (i: HubItem): Row => ({
          id: i.id,
          title: i.title,
          sub: `${formatDate(i.ended_at)} 마감 · 응답 ${i.response_count}명`,
        });
        setRows({
          answered: items.filter((i) => i.answered).map(toRow),
          saved: items.filter((i) => saved.includes(i.id)).map(toRow),
          viewed: ((views.data as MyView[] | null) ?? []).map((v) => ({
            id: v.survey_id,
            title: v.title,
            sub: `${formatDate(v.viewed_at)} 열람 · ${v.paid > 0 ? formatPoints(v.paid) : "무료"}`,
          })),
        });
      });
    }, []),
  );

  if (rows === null) return <ActivityIndicator color={colors.primary} style={styles.loading} />;

  const shown = rows[tab];
  return (
    <>
      <TextTabs
        options={[
          { value: "answered", label: `응답한 ${rows.answered.length}` },
          { value: "saved", label: `스크랩 ${rows.saved.length}` },
          { value: "viewed", label: `열람한 ${rows.viewed.length}` },
        ]}
        value={tab}
        onChange={setTab}
      />
      {shown.length === 0 ? (
        <EmptyState {...EMPTY[tab]} />
      ) : (
        <Card>
          {shown.map((r, i) => (
            <Pressable
              key={r.id}
              style={[styles.row, i > 0 && styles.rowDivider]}
              onPress={() => router.push({ pathname: "/data/[id]", params: { id: String(r.id) } })}
            >
              <View style={styles.rowMain}>
                <Text style={styles.title} numberOfLines={2}>
                  {r.title}
                </Text>
                <Text style={styles.muted}>{r.sub}</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </Pressable>
          ))}
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    marginTop: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  muted: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  arrow: {
    fontSize: fontSize.subtitle,
    color: colors.textSubtle,
  },
});
