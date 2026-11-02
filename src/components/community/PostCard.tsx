import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import LinkedText from "@/components/LinkedText";
import { percent } from "@/components/results/QuestionResult";
import Badge from "@/components/ui/Badge";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, shadow, spacing } from "@/constants/theme";
import { KIND_LABELS, type PromoSurvey, type Post } from "@/lib/community";
import { errorMessage } from "@/lib/errors";
import { formatAgo, formatDateTime, formatPoints, formatTimeLeft } from "@/lib/format";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

type Props = {
  post: Post;
  // 투표가 끝나면 (목록·상세를 다시 불러오게)
  onVoted: () => void;
  // 카드 전체를 눌렀을 때 (목록에서는 상세로). 없으면 누를 수 없음
  onOpen?: () => void;
  // 상세 화면: 본문을 줄이지 않고 다 보여 준다
  full?: boolean;
  // HOT 게시판에 든 글이면 🔥 HOT 뱃지 (2026-11-03)
  hot?: boolean;
};

// 투표 글: 투표 전엔 보기 버튼, 투표 후(또는 내 글)엔 비율 막대
// 목록에서는 카드 없이 구분선으로 나뉜 한 줄(피드), 상세(full)에서는 카드 (2026-11-03)
export default function PostCard({ post, onVoted, onOpen, full, hot }: Props) {
  const [sending, setSending] = useState(false);
  const [earned, setEarned] = useState<number | null>(null);
  const showResult = post.counts !== null;
  const total = (post.counts ?? []).reduce((a, b) => a + b, 0);

  const vote = async (choice: number) => {
    if (sending) return;
    setSending(true);
    const { data, error } = await supabase.rpc("vote_post", { p_post_id: post.id, p_choice: choice });
    setSending(false);
    if (error) {
      showNotice("투표하지 못했어요", errorMessage(error));
      onVoted();
      return;
    }
    setEarned((data as { reward: number }).reward);
    onVoted();
  };

  return (
    <Pressable
      style={({ pressed }) => [full ? styles.card : styles.row, !full && pressed && styles.rowPressed]}
      onPress={onOpen}
      disabled={!onOpen}
    >
      {/* 머리: 종류 · HOT 뱃지 */}
      <View style={styles.head}>
        <Badge label={KIND_LABELS[post.kind]} tone={post.kind === "promo" ? "accent" : "primary"} />
        {hot && <Badge label="🔥 HOT" tone="hot" />}
      </View>
      <Text style={[styles.question, !full && styles.questionList]} selectable={full}>
        {post.question}
      </Text>
      {/* 본문: 주소는 링크, 상세에서는 길게 눌러 복사 */}
      {post.body ? (
        <LinkedText style={styles.body} numberOfLines={full ? undefined : 2} selectable={full}>
          {post.body}
        </LinkedText>
      ) : null}

      {post.kind === "promo" && post.survey ? (
        <PromoBox survey={post.survey} mine={post.mine} />
      ) : showResult ? (
        <View style={styles.results}>
          {post.options.map((label, i) => {
            const count = post.counts?.[i] ?? 0;
            const pct = percent(count, total);
            const mine = post.my_choice === i;
            return (
              <View key={i} style={styles.resultRow}>
                <View style={styles.resultLabels}>
                  <Text style={[styles.resultLabel, mine && styles.mineText]} numberOfLines={1}>
                    {label}
                    {mine ? "  ✓" : ""}
                  </Text>
                  <Text style={[styles.resultPct, mine && styles.mineText]}>{pct}%</Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, mine && styles.fillMine, { width: `${pct}%` }]} />
                </View>
              </View>
            );
          })}
          {post.mine && post.my_choice === null && <Text style={styles.meta}>내 글이라 결과를 먼저 볼 수 있어요.</Text>}
          {earned !== null && earned > 0 && <Text style={styles.earned}>+{formatPoints(earned)} 받았어요</Text>}
        </View>
      ) : (
        <View style={post.options.length === 2 ? styles.buttonsRow : styles.buttonsCol}>
          {post.options.map((label, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [
                styles.choice,
                !full && styles.choiceSmall,
                post.options.length === 2 && styles.choiceHalf,
                pressed && styles.choicePressed,
              ]}
              onPress={() => vote(i)}
              disabled={sending}
            >
              <Text style={styles.choiceText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* 아래 한 줄: 작성자 · 시간 · 댓글 · 참여 */}
      <Text style={styles.footer} numberOfLines={1}>
        {post.author}
        {post.mine ? " (나)" : ""} · {full ? formatDateTime(post.created_at) : formatAgo(post.created_at)}
        {post.comment_count > 0 ? `  💬 ${post.comment_count}` : ""}
        {post.kind !== "promo" ? `  👥 ${post.votes}` : ""}
      </Text>
    </Pressable>
  );
}

// 설문 홍보글: 설문 요약 + [응답하러 가기]
function PromoBox({ survey, mine }: { survey: PromoSurvey; mine: boolean }) {
  const open = () => router.push({ pathname: "/survey/[id]", params: { id: String(survey.id) } });
  const label = mine ? "내 설문 보기" : survey.answered ? "이미 응답했어요" : survey.open ? "응답하러 가기" : "마감된 설문이에요";
  return (
    <View style={styles.promo}>
      <Text style={styles.promoTitle} numberOfLines={2}>
        📋 {survey.title}
      </Text>
      <Text style={styles.meta}>
        {survey.questions}문항 · 약 {survey.minutes}분 · +{formatPoints(survey.reward)} · 남은 자리 {survey.remaining}명
        {survey.closes_at ? ` · ${formatTimeLeft(survey.closes_at)}` : ""}
      </Text>
      <Pressable
        style={[styles.promoButton, (survey.answered || !survey.open) && !mine && styles.promoButtonOff]}
        onPress={open}
        disabled={(survey.answered || !survey.open) && !mine}
      >
        <Text style={styles.promoButtonText}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  promo: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    gap: spacing.sm,
  },
  promoTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  promoButton: {
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  promoButtonOff: {
    backgroundColor: colors.textMuted,
  },
  promoButtonText: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.sm,
    ...shadow.card,
  },
  // 목록 한 줄: 카드 없이 흰 바탕 + 아래 구분선
  row: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  footer: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  meta: {
    flexShrink: 1,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  question: {
    fontSize: fontSize.subtitle,
    fontWeight: "700",
    color: colors.text,
  },
  questionList: {
    fontSize: fontSize.body,
  },
  body: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  buttonsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  buttonsCol: {
    gap: spacing.sm,
  },
  choice: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  choiceSmall: {
    paddingVertical: spacing.sm,
  },
  choiceHalf: {
    flex: 1,
  },
  choicePressed: {
    borderColor: colors.primary,
  },
  choiceText: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
  results: {
    gap: spacing.sm,
  },
  resultRow: {
    gap: 4,
  },
  resultLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  resultLabel: {
    flex: 1,
    fontSize: fontSize.small,
    color: colors.text,
  },
  resultPct: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  mineText: {
    color: colors.primary,
    fontWeight: "700",
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMuted,
  },
  fillMine: {
    backgroundColor: colors.primary,
  },
  earned: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.primary,
  },
});
