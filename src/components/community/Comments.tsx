import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import LinkedText from "@/components/LinkedText";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import { type Comment, COMMENT_MAX, type CommentTarget } from "@/lib/community";
import { showActions, showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

type Loaded = { best: Comment[]; all: Comment[] };

// 댓글 목록 + 입력칸 (커뮤니티 글 · 지난 오늘의 질문). 베스트 3개(좋아요 순) → 전체(오래된 순)
export default function Comments({ type, id, onChanged }: { type: CommentTarget; id: number; onChanged?: () => void }) {
  const [list, setList] = useState<Loaded | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    supabase
      .rpc("get_comments", { p_type: type, p_id: id })
      .then(({ data }) => setList((data as Loaded | null) ?? { best: [], all: [] }));
  }, [type, id]);

  useEffect(load, [load]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const { error } = await supabase.rpc("create_comment", { p_type: type, p_id: id, p_body: text.trim() });
    setSending(false);
    if (error) {
      showNotice("댓글을 달지 못했어요", errorMessage(error));
      return;
    }
    setText("");
    load();
    onChanged?.();
  };

  const like = async (c: Comment) => {
    const { error } = await supabase.rpc("like_comment", { p_comment_id: c.id });
    if (error) showNotice("좋아요를 누르지 못했어요", errorMessage(error));
    load();
  };

  const more = (c: Comment) =>
    showActions(
      "댓글",
      c.mine
        ? [
            {
              label: "삭제",
              destructive: true,
              onPress: () =>
                showConfirm({
                  title: "댓글을 지울까요?",
                  message: "",
                  okLabel: "삭제",
                  cancelLabel: "취소",
                  destructive: true,
                  onOk: async () => {
                    const { error } = await supabase.rpc("delete_comment", { p_comment_id: c.id });
                    if (error) showNotice("지우지 못했어요", errorMessage(error));
                    load();
                    onChanged?.();
                  },
                }),
            },
          ]
        : [
            {
              label: "신고",
              onPress: () => router.push({ pathname: "/report", params: { type: "comment", id: String(c.id) } }),
            },
          ],
    );

  const row = (c: Comment, best: boolean) => (
    <View key={`${best ? "b" : "a"}${c.id}`} style={[styles.comment, best && styles.best]}>
      <View style={styles.head}>
        <Text style={styles.author}>
          {best ? "🏆 " : ""}
          {c.author}
          {c.mine ? " (나)" : ""}
        </Text>
        <Text style={styles.date}>{formatDate(c.created_at)}</Text>
        <Pressable onPress={() => more(c)} hitSlop={8}>
          <Text style={styles.more}>⋯</Text>
        </Pressable>
      </View>
      <LinkedText style={styles.body} selectable>
        {c.body}
      </LinkedText>
      <Pressable onPress={() => like(c)} disabled={c.mine} hitSlop={8}>
        <Text style={[styles.like, c.liked && styles.liked]}>
          {c.liked ? "♥" : "♡"} {c.likes}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.box}>
      <Text style={styles.title}>댓글 {list ? list.all.length : ""}</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="댓글을 남겨 주세요"
          maxLength={COMMENT_MAX}
          multiline
        />
        <Pressable onPress={send} disabled={!text.trim() || sending} hitSlop={8}>
          <Text style={[styles.send, (!text.trim() || sending) && styles.sendOff]}>등록</Text>
        </Pressable>
      </View>

      {list && list.best.length > 0 && <View style={styles.list}>{list.best.map((c) => row(c, true))}</View>}

      {list && list.all.length === 0 ? (
        <Text style={styles.empty}>첫 댓글을 남겨 보세요.</Text>
      ) : (
        <View style={styles.list}>{list?.all.map((c) => row(c, false))}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: fontSize.body,
    color: colors.text,
    maxHeight: 100,
  },
  send: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.primary,
  },
  sendOff: {
    color: colors.textMuted,
  },
  list: {
    gap: spacing.sm,
  },
  comment: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 4,
  },
  best: {
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    borderBottomWidth: 0,
    backgroundColor: colors.border,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  author: {
    flex: 1,
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.text,
  },
  date: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  more: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    paddingHorizontal: 4,
  },
  body: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  like: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  liked: {
    color: colors.danger,
    fontWeight: "700",
  },
  empty: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.md,
  },
});
