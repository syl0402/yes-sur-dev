import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import LinkedText from "@/components/LinkedText";
import { percent } from "@/components/results/QuestionResult";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import { KIND_LABELS, type PromoSurvey, type Post } from "@/lib/community";
import { errorMessage } from "@/lib/errors";
import { formatPoints, formatTimeLeft } from "@/lib/format";
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
};

// 투표 글 카드: 투표 전엔 보기 버튼, 투표 후(또는 내 글)엔 비율 막대
export default function PostCard({ post, onVoted, onOpen, full }: Props) {
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
    <Pressable style={styles.card} onPress={onOpen} disabled={!onOpen}>
      <View style={styles.head}>
        <Text style={styles.kind}>{KIND_LABELS[post.kind]}</Text>
        <Text style={styles.meta}>
          {post.author}
          {post.mine ? " (나)" : ""}
          {post.kind === "promo" ? "" : ` · ${post.votes}명 참여`}
          {post.comment_count > 0 ? ` · 댓글 ${post.comment_count}` : ""}
        </Text>
      </View>
      <Text style={styles.question} selectable={full}>
        {post.question}
      </Text>
      {/* 본문: 주소는 링크, 상세에서는 길게 눌러 복사 */}
      {post.body ? (
        <LinkedText style={styles.body} numberOfLines={full ? undefined : 3} selectable={full}>
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
              style={({ pressed }) => [styles.choice, post.options.length === 2 && styles.choiceHalf, pressed && styles.choicePressed]}
              onPress={() => vote(i)}
              disabled={sending}
            >
              <Text style={styles.choiceText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}
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
    borderRadius: 10,
    backgroundColor: colors.border,
    gap: spacing.sm,
  },
  promoTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  promoButton: {
    paddingVertical: spacing.sm,
    borderRadius: 10,
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
    borderRadius: 12,
    gap: spacing.sm,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  kind: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.primary,
  },
  meta: {
    flexShrink: 1,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  question: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
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
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: colors.textMuted,
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
