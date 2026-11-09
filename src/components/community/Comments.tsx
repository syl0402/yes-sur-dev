import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import AnonToggle from "@/components/community/AnonToggle";
import LinkedText from "@/components/LinkedText";
import Badge from "@/components/ui/Badge";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { type Comment, COMMENT_MAX, type CommentTarget, fetchCanAnonymous } from "@/lib/community";
import { showActions, showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { formatCommentTime } from "@/lib/format";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

type Loaded = { best: Comment[]; all: Comment[] };

// 댓글 목록 + 입력칸 (커뮤니티 글 · 오늘의 질문 · 월드컵), 2026-11-03 개편
// 이름은 서버가 정한다 (익명1 · 익명(글쓴이) · 닉네임). 답글은 한 단계. 👍 공감. BEST는 공감이 기준 이상일 때만
export default function Comments({ type, id, onChanged }: { type: CommentTarget; id: number; onChanged?: () => void }) {
  const [list, setList] = useState<Loaded | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [anonymous, setAnonymous] = useState(true);
  // 익명으로 쓸 수 있는 사람(학생)만 체크가 보인다
  const [canAnon, setCanAnon] = useState(false);
  // 답글 입력칸이 열린 댓글
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");

  const load = useCallback(() => {
    supabase
      .rpc("get_comments", { p_type: type, p_id: id })
      .then(({ data }) => setList((data as Loaded | null) ?? { best: [], all: [] }));
  }, [type, id]);

  useEffect(load, [load]);
  useEffect(() => {
    fetchCanAnonymous().then(setCanAnon);
  }, []);

  // 댓글·답글 보내기 (성공하면 true)
  const post = async (body: string, parentId: number | null) => {
    if (!body.trim() || sending) return false;
    setSending(true);
    const { error } = await supabase.rpc("create_comment", {
      p_type: type,
      p_id: id,
      p_body: body.trim(),
      p_parent_id: parentId ?? undefined,
      p_anonymous: anonymous,
    });
    setSending(false);
    if (error) {
      showNotice("댓글을 달지 못했어요", errorMessage(error));
      load();
      return false;
    }
    load();
    onChanged?.();
    return true;
  };

  const send = async () => {
    if (await post(text, null)) setText("");
  };

  const sendReply = async (parentId: number) => {
    if (await post(replyText, parentId)) {
      setReplyText("");
      setReplyTo(null);
    }
  };

  const like = async (c: Comment) => {
    const { error } = await supabase.rpc("like_comment", { p_comment_id: c.id });
    if (error) showNotice("공감하지 못했어요", errorMessage(error));
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

  const openReply = (c: Comment) => {
    setReplyTo(replyTo === c.id ? null : c.id);
    setReplyText("");
  };

  // 댓글 한 줄 (원댓글·답글·BEST 공통)
  const row = (c: Comment, opts: { best?: boolean; reply?: boolean } = {}) => {
    if (c.deleted) {
      return <Text style={styles.deleted}>삭제된 댓글이에요.</Text>;
    }
    const canReply = !opts.reply && !opts.best;
    return (
      <View style={styles.row}>
        <View style={styles.head}>
          {opts.best && <Badge label="BEST" tone="hot" />}
          <Text style={[styles.author, c.author === "익명(글쓴이)" && styles.writer]} numberOfLines={1}>
            {c.author}
            {c.mine ? " (나)" : ""}
          </Text>
          {/* 오른쪽 작은 버튼 묶음: 답글 · 공감 · 더보기 */}
          <View style={styles.actions}>
            {canReply && (
              <Pressable onPress={() => openReply(c)} hitSlop={6} accessibilityLabel="답글">
                <Text style={styles.action}>답글</Text>
              </Pressable>
            )}
            {!c.mine && (
              <Pressable onPress={() => like(c)} hitSlop={6} accessibilityLabel="공감">
                <Text style={[styles.action, c.liked && styles.actionOn]}>👍</Text>
              </Pressable>
            )}
            <Pressable onPress={() => more(c)} hitSlop={6} accessibilityLabel="더보기">
              <Text style={styles.action}>⋯</Text>
            </Pressable>
          </View>
        </View>
        <LinkedText style={styles.body} selectable>
          {c.body}
        </LinkedText>
        <View style={styles.foot}>
          <Text style={styles.date}>{formatCommentTime(c.created_at)}</Text>
          {c.likes > 0 && <Text style={[styles.likes, c.liked && styles.likesOn]}>👍 {c.likes}</Text>}
        </View>
      </View>
    );
  };

  // 화면에 보이는 댓글 수 (지운 자리는 빼고 답글은 더함)
  const count = (list?.all ?? []).reduce((n, c) => n + (c.deleted ? 0 : 1) + (c.replies?.length ?? 0), 0);

  return (
    <View style={styles.box}>
      <Text style={styles.title}>댓글 {list ? count : ""}</Text>

      <View style={styles.inputRow}>
        {canAnon && <AnonToggle value={anonymous} onChange={setAnonymous} />}
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

      {list && list.best.length > 0 && (
        <View style={styles.bestBox}>
          {list.best.map((c) => (
            <View key={`b${c.id}`}>{row(c, { best: true })}</View>
          ))}
        </View>
      )}

      {list && list.all.length === 0 ? (
        <Text style={styles.empty}>첫 댓글을 남겨 보세요.</Text>
      ) : (
        list?.all.map((c) => (
          <View key={c.id} style={styles.thread}>
            {row(c)}
            {(c.replies ?? []).map((r) => (
              <View key={r.id} style={styles.replyRow}>
                <Text style={styles.arrow}>↳</Text>
                <View style={styles.replyBox}>{row(r, { reply: true })}</View>
              </View>
            ))}
            {replyTo === c.id && (
              <View style={styles.replyRow}>
                <Text style={styles.arrow}>↳</Text>
                <View style={[styles.inputRow, styles.replyInput]}>
                  <TextInput
                    style={styles.input}
                    value={replyText}
                    onChangeText={setReplyText}
                    placeholder="답글을 남겨 주세요"
                    maxLength={COMMENT_MAX}
                    multiline
                    autoFocus
                  />
                  <Pressable onPress={() => sendReply(c.id)} disabled={!replyText.trim() || sending} hitSlop={8}>
                    <Text style={[styles.send, (!replyText.trim() || sending) && styles.sendOff]}>등록</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        ))
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
    borderRadius: radius.md,
    backgroundColor: colors.surface,
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
  bestBox: {
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.hotSoft,
  },
  // 원댓글 + 답글 묶음, 아래 구분선
  thread: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    paddingVertical: spacing.sm,
    gap: 4,
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
  writer: {
    color: colors.primary,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  action: {
    fontSize: fontSize.caption,
    fontWeight: "600",
    color: colors.textMuted,
  },
  actionOn: {
    color: colors.hot,
  },
  body: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  date: {
    fontSize: fontSize.caption,
    color: colors.textSubtle,
  },
  likes: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  likesOn: {
    color: colors.hot,
    fontWeight: "700",
  },
  deleted: {
    paddingVertical: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textSubtle,
  },
  replyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  arrow: {
    paddingTop: spacing.sm,
    fontSize: fontSize.body,
    color: colors.textSubtle,
  },
  replyBox: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  replyInput: {
    flex: 1,
  },
  empty: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.md,
  },
});
