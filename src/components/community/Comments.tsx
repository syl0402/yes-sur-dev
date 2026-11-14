// 댓글 목록 (커뮤니티 글 · 오늘의 질문 · 월드컵), 2026-11-03 개편 · 2026-11-14 커뮤니티 시안 반영
// 이름은 서버가 정한다 (익명1 · 익명(글쓴이) · 닉네임). 답글은 한 단계 (왼쪽 세로줄로 들여쓰기)
// 한 댓글: [BEST] 이름 [고른 편] ⋯ / 본문 / 시간 · 좋아요 n · 답글 달기
// 입력칸은 화면 맨 아래 고정(CommentComposer). 상태는 useCommentThread가 들고 있다
import { Pressable, StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import LinkedText from "@/components/LinkedText";
import Badge from "@/components/ui/Badge";
import { Text } from "@/components/ui/Text";
import { commentIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import type { CommentThread } from "@/hooks/useCommentThread";
import type { Comment } from "@/lib/community";
import { formatCommentTime } from "@/lib/format";

type Props = {
  thread: CommentThread;
  // 투표 글의 보기 이름. 주면 댓글마다 쓴 사람이 고른 편 배지 (2026-11-14)
  sides?: string[];
};

export default function Comments({ thread, sides }: Props) {
  const { list, like, more, replyTo, setReplyTo } = thread;

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
          {sides && c.side != null && sides[c.side] !== undefined && <SideBadge sides={sides} side={c.side} />}
          <View style={styles.spacer} />
          <Pressable onPress={() => more(c)} hitSlop={10} accessibilityLabel="댓글 메뉴">
            <AppIcon name={commentIcons.more} size={16} color={colors.textSubtle} />
          </Pressable>
        </View>
        <LinkedText style={styles.body} selectable>
          {c.body}
        </LinkedText>
        {/* 아래 한 줄: 시간 · 좋아요 · 답글 달기 */}
        <View style={styles.foot}>
          <Text style={styles.footText}>{formatCommentTime(c.created_at)}</Text>
          {c.mine ? (
            c.likes > 0 && <Text style={styles.footText}>좋아요 {c.likes}</Text>
          ) : (
            <Pressable onPress={() => like(c)} hitSlop={6} accessibilityLabel="좋아요">
              <Text style={[styles.footText, c.liked && styles.liked]}>좋아요{c.likes > 0 ? ` ${c.likes}` : ""}</Text>
            </Pressable>
          )}
          {canReply && (
            <Pressable onPress={() => setReplyTo(replyTo?.id === c.id ? null : c)} hitSlop={6}>
              <Text style={[styles.footText, replyTo?.id === c.id && styles.liked]}>답글 달기</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  // 화면에 보이는 댓글 수 (지운 자리는 빼고 답글은 더함)
  const count = (list?.all ?? []).reduce((n, c) => n + (c.deleted ? 0 : 1) + (c.replies?.length ?? 0), 0);

  return (
    <View style={styles.box}>
      <Text style={styles.title}>댓글 {list ? count : ""}</Text>

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
            {(c.replies ?? []).length > 0 && (
              <View style={styles.replies}>
                {(c.replies ?? []).map((r) => (
                  <View key={r.id}>{row(r, { reply: true })}</View>
                ))}
              </View>
            )}
          </View>
        ))
      )}
    </View>
  );
}

// 고른 편 배지: "○○파". 두 편 글은 첫 번째 편 파랑 · 두 번째 편 라임, 보기가 여러 개면 회색 (2026-11-14)
function SideBadge({ sides, side }: { sides: string[]; side: number }) {
  const name = sides[side];
  const short = name.length > 8 ? `${name.slice(0, 8)}…` : name;
  const duel = sides.length === 2;
  const tone = !duel ? styles.sideMuted : side === 0 ? styles.sideA : styles.sideB;
  const text = !duel ? styles.sideMutedText : side === 0 ? styles.sideAText : styles.sideBText;
  return (
    <View style={[styles.side, tone]}>
      <Text style={[styles.sideText, text]}>{duel ? `${short}파` : short}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSize.body,
    fontWeight: "800",
    color: colors.text,
  },
  bestBox: {
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.hotSoft,
  },
  // 원댓글 + 답글 묶음, 아래 구분선
  thread: {
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  row: {
    paddingVertical: spacing.sm,
    gap: 4,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  author: {
    flexShrink: 1,
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.text,
  },
  writer: {
    color: colors.primary,
  },
  spacer: {
    flex: 1,
  },
  side: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  sideText: {
    fontSize: 11,
    fontWeight: "700",
  },
  sideA: {
    backgroundColor: colors.primarySoft,
  },
  sideAText: {
    color: colors.primaryStrong,
  },
  sideB: {
    backgroundColor: colors.accentSoft,
  },
  sideBText: {
    color: colors.onAccentSoft,
  },
  sideMuted: {
    backgroundColor: colors.surfaceMuted,
  },
  sideMutedText: {
    color: colors.textStrong,
  },
  body: {
    fontSize: fontSize.body,
    lineHeight: 23,
    color: colors.text,
  },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 2,
  },
  footText: {
    fontSize: fontSize.caption,
    color: colors.iconStrong,
  },
  liked: {
    color: colors.primary,
    fontWeight: "700",
  },
  // 답글: 왼쪽 세로줄 들여쓰기
  replies: {
    marginLeft: 12,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
  deleted: {
    paddingVertical: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textSubtle,
  },
  empty: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.md,
  },
});
