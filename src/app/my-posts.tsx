// ys-158 내 커뮤니티 활동 · F-601 (마이 탭에서. 2026-11-10 "내가 쓴 글" → 2026-11-14 마이 탭 시안 ⑥)
// 요약(참여 · 오늘의 질문 연속 · 커뮤니티로 받은 포인트) → [글 | 댓글 | 참여] 최신순, 누르면 그 글로
// 참여: 내가 투표한 밸런스·나만 그래?·골라 줘 · 답한 오늘의 질문 · 한 월드컵 + 내가 고른 답 (get_my_participation, 본인 것만)
import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ListRow, { rowsCard } from "@/components/ui/ListRow";
import { Text } from "@/components/ui/Text";
import TextTabs from "@/components/ui/TextTabs";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { type CommentTarget, KIND_LABELS } from "@/lib/community";
import { formatAgo, formatPoints, formatShortDate } from "@/lib/format";
import { fetchMyCommunity, type Moderation, type MyComment, type MyCommunity, type MyVote } from "@/lib/myActivity";
import { supabase } from "@/lib/supabase";

type Tab = "posts" | "comments" | "votes";

const TARGET_LABELS: Record<CommentTarget, string> = {
  post: "글",
  daily: "오늘의 질문",
  worldcup: "월드컵",
};

const MODERATION_LABELS: Record<Exclude<Moderation, "visible">, string> = {
  hidden: "검토 중",
  removed: "운영자 삭제",
};

// 커뮤니티로 받은 포인트에 넣는 기록 (투표 · 내 글 인기 보너스)
const COMMUNITY_REASONS = ["community", "creator_bonus"];

// 댓글을 누르면 갈 곳. 지난 오늘의 질문은 null (누를 수 없음)
function openComment(c: MyComment): (() => void) | undefined {
  if (c.target_type === "post") return () => router.push({ pathname: "/community/[id]", params: { id: String(c.target_id) } });
  if (c.target_type === "worldcup")
    return () => router.push({ pathname: "/community/worldcup/[id]", params: { id: String(c.target_id) } });
  return c.today ? () => router.push("/community/daily") : undefined;
}

// 참여 한 줄: 종류 이름 · 누르면 갈 곳 (지난 오늘의 질문은 갈 화면이 없다)
function voteKind(v: MyVote): string {
  if (v.type === "daily") return "오늘의 질문";
  if (v.type === "worldcup") return "월드컵";
  return v.kind ? KIND_LABELS[v.kind] : "투표";
}
function openVote(v: MyVote): (() => void) | undefined {
  if (v.type === "post") return () => router.push({ pathname: "/community/[id]", params: { id: String(v.id) } });
  if (v.type === "worldcup") return () => router.push({ pathname: "/community/worldcup/[id]", params: { id: String(v.id) } });
  return undefined;
}

export default function MyPosts() {
  const [tab, setTab] = useState<Tab>("posts");
  const [data, setData] = useState<MyCommunity | null>(null);
  const [streak, setStreak] = useState(0);
  const [earned, setEarned] = useState(0);

  // 글에서 돌아왔을 때 지우거나 바뀐 것이 바로 보이게 매번 새로 불러온다
  useFocusEffect(
    useCallback(() => {
      fetchMyCommunity().then(setData);
      supabase.rpc("get_today_daily").then(({ data: d }) => setStreak((d as { streak?: number } | null)?.streak ?? 0));
      supabase
        .from("point_ledger")
        .select("amount")
        .eq("status", "confirmed")
        .in("reason", COMMUNITY_REASONS)
        .then(({ data: rows }) => setEarned((rows ?? []).reduce((sum, r) => sum + r.amount, 0)));
    }, []),
  );

  if (data === null) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ title: "내 커뮤니티 활동" }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const { posts, comments, votes } = data;

  return (
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "내 커뮤니티 활동" }} />

      {/* 요약 3칸 */}
      <Card style={styles.summary}>
        {[
          { label: "참여", value: String(votes.length) },
          { label: "오늘의 질문 연속", value: `${streak}일` },
          { label: "커뮤니티로 받은", value: `+${formatPoints(earned)}`, strong: true },
        ].map((m, i) => (
          <View key={m.label} style={[styles.cell, i > 0 && styles.cellLine]}>
            <Text style={[styles.cellValue, m.strong && styles.cellStrong]}>{m.value}</Text>
            <Text style={styles.cellLabel}>{m.label}</Text>
          </View>
        ))}
      </Card>

      <TextTabs
        options={[
          { value: "posts", label: `글 ${posts.length}` },
          { value: "comments", label: `댓글 ${comments.length}` },
          { value: "votes", label: `참여 ${votes.length}` },
        ]}
        value={tab}
        onChange={setTab}
        fill
      />
      <Text style={styles.muted}>
        {tab === "votes" ? "내가 고른 답은 나에게만 보여요." : "익명으로 쓴 글·댓글도 여기서는 나에게만 보여요."}
      </Text>

      {tab === "posts" &&
        (posts.length === 0 ? (
          <EmptyState title="아직 쓴 글이 없어요" message="커뮤니티에서 투표 글을 올려 보세요." emoji="✏️" />
        ) : (
          posts.map((p) => (
            <Card key={p.id} onPress={() => router.push({ pathname: "/community/[id]", params: { id: String(p.id) } })}>
              <View style={styles.cardTop}>
                <Badge label={KIND_LABELS[p.kind]} tone={p.kind === "promo" ? "accent" : "primary"} />
                {p.moderation !== "visible" && <Badge label={MODERATION_LABELS[p.moderation]} tone="danger" />}
                <Text style={styles.muted}>{formatShortDate(p.created_at)}</Text>
              </View>
              <Text style={styles.title} numberOfLines={2}>
                {p.question}
              </Text>
              <Text style={styles.muted}>
                {p.kind === "promo" ? "" : p.votes > 0 ? `${p.votes}명 참여 · ` : "아직 참여 없음 · "}댓글 {p.comment_count}
              </Text>
            </Card>
          ))
        ))}

      {tab === "comments" &&
        (comments.length === 0 ? (
          <EmptyState title="아직 쓴 댓글이 없어요" message="글·오늘의 질문·월드컵에 댓글을 남길 수 있어요." emoji="💬" />
        ) : (
          <Card style={rowsCard}>
            {comments.map((c, i) => (
              <ListRow
                key={c.id}
                first={i === 0}
                title={c.body}
                titleLines={2}
                sub={`${c.moderation !== "visible" ? `${MODERATION_LABELS[c.moderation]} · ` : ""}${TARGET_LABELS[c.target_type]} · ${c.target_title ?? ""} · ${formatAgo(c.created_at)}`}
                onPress={openComment(c)}
              />
            ))}
          </Card>
        ))}

      {tab === "votes" &&
        (votes.length === 0 ? (
          <EmptyState title="아직 참여한 투표가 없어요" message="커뮤니티 투표·오늘의 질문·월드컵에 참여해 보세요." emoji="🗳️" />
        ) : (
          <Card style={rowsCard}>
            {votes.map((v, i) => (
              <ListRow
                key={`${v.type}-${v.id}`}
                first={i === 0}
                title={v.title}
                sub={`${voteKind(v)} · ${formatShortDate(v.created_at)}`}
                onPress={openVote(v)}
                right={v.choice ? <ChoiceChip vote={v} /> : undefined}
              />
            ))}
          </Card>
        ))}
    </ScrollView>
  );
}

// 내가 고른 답 칩: 밸런스·오늘의 질문 파랑 · 월드컵 "내 1위 …" 노랑 · 나머지 회색
function ChoiceChip({ vote: v }: { vote: MyVote }) {
  const tone = v.type === "worldcup" ? styles.chipCup : v.type === "daily" || v.kind === "balance" ? styles.chipBlue : styles.chipGray;
  const text =
    v.type === "worldcup" ? styles.chipCupText : v.type === "daily" || v.kind === "balance" ? styles.chipBlueText : styles.chipGrayText;
  const label = v.type === "worldcup" ? `내 1위 ${v.choice}` : v.kind === "balance" ? `${v.choice}파` : (v.choice ?? "");
  return (
    <View style={[styles.chip, tone]}>
      <Text style={[styles.chipText, text]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  summary: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 0,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  cellLine: {
    borderLeftWidth: 1,
    borderLeftColor: colors.surfaceMuted,
  },
  cellValue: {
    fontSize: fontSize.subtitle,
    fontWeight: "800",
    color: colors.text,
  },
  cellStrong: {
    color: colors.primaryStrong,
  },
  cellLabel: {
    fontSize: fontSize.caption,
    color: colors.iconStrong,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
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
  chip: {
    maxWidth: 130,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  chipBlue: {
    backgroundColor: colors.primarySoft,
  },
  chipBlueText: {
    color: colors.primaryStrong,
  },
  chipCup: {
    backgroundColor: colors.warningSoft,
  },
  chipCupText: {
    color: colors.warning,
  },
  chipGray: {
    backgroundColor: colors.surfaceMuted,
  },
  chipGrayText: {
    color: colors.textStrong,
  },
});
