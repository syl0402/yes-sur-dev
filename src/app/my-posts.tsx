// ys-158 내가 쓴 글 · F-601 (마이 탭에서. [글 | 댓글] 최신순, 누르면 그 글로. 2026-11-10 개인 피드백)
import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ListRow, { rowsCard } from "@/components/ui/ListRow";
import Segmented from "@/components/ui/Segmented";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import { type CommentTarget, KIND_LABELS, type PostKind } from "@/lib/community";
import { formatAgo } from "@/lib/format";
import { supabase } from "@/lib/supabase";

type Tab = "posts" | "comments";

// 신고로 숨겨짐 · 운영자 삭제 (내가 지운 것은 서버가 뺀다)
type Moderation = "visible" | "hidden" | "removed";

// get_my_posts 한 줄
type MyPost = {
  id: number;
  kind: PostKind;
  question: string;
  moderation: Moderation;
  created_at: string;
  votes: number;
  comment_count: number;
};

// get_my_comments 한 줄. today: 오늘의 질문이 오늘 것인지 (지난 질문은 갈 화면이 없다)
type MyComment = {
  id: number;
  body: string;
  moderation: Moderation;
  created_at: string;
  target_type: CommentTarget;
  target_id: number;
  target_title: string | null;
  today: boolean;
};

const TARGET_LABELS: Record<CommentTarget, string> = {
  post: "글",
  daily: "오늘의 질문",
  worldcup: "월드컵",
};

const MODERATION_LABELS: Record<Exclude<Moderation, "visible">, string> = {
  hidden: "검토 중",
  removed: "운영자 삭제",
};

// 댓글을 누르면 갈 곳. 지난 오늘의 질문은 null (누를 수 없음)
function openComment(c: MyComment): (() => void) | undefined {
  if (c.target_type === "post") return () => router.push({ pathname: "/community/[id]", params: { id: String(c.target_id) } });
  if (c.target_type === "worldcup")
    return () => router.push({ pathname: "/community/worldcup/[id]", params: { id: String(c.target_id) } });
  return c.today ? () => router.push("/community/daily") : undefined;
}

export default function MyPosts() {
  const [tab, setTab] = useState<Tab>("posts");
  const [posts, setPosts] = useState<MyPost[] | null>(null);
  const [comments, setComments] = useState<MyComment[]>([]);

  // 글에서 돌아왔을 때 지우거나 바뀐 것이 바로 보이게 매번 새로 불러온다
  useFocusEffect(
    useCallback(() => {
      Promise.all([supabase.rpc("get_my_posts"), supabase.rpc("get_my_comments")]).then(([p, c]) => {
        setPosts((p.data as MyPost[] | null) ?? []);
        setComments((c.data as MyComment[] | null) ?? []);
      });
    }, []),
  );

  if (posts === null) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ title: "내가 쓴 글" }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "내가 쓴 글" }} />
      <Segmented
        options={[
          { value: "posts", label: `글 ${posts.length}` },
          { value: "comments", label: `댓글 ${comments.length}` },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Text style={styles.muted}>익명으로 쓴 글·댓글도 여기서는 나에게만 보여요.</Text>

      {tab === "posts" &&
        (posts.length === 0 ? (
          <EmptyState title="아직 쓴 글이 없어요" message="커뮤니티에서 투표 글을 올려 보세요." emoji="✏️" />
        ) : (
          posts.map((p) => (
            <Card key={p.id} onPress={() => router.push({ pathname: "/community/[id]", params: { id: String(p.id) } })}>
              <View style={styles.cardTop}>
                <Badge label={KIND_LABELS[p.kind]} />
                {p.moderation !== "visible" && <Badge label={MODERATION_LABELS[p.moderation]} tone="danger" />}
              </View>
              <Text style={styles.title} numberOfLines={2}>
                {p.question}
              </Text>
              <Text style={styles.muted}>
                투표 {p.votes} · 댓글 {p.comment_count} · {formatAgo(p.created_at)}
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
    </ScrollView>
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
  cardTop: {
    flexDirection: "row",
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
});
