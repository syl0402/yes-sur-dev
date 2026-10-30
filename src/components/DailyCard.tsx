import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { percent } from "@/components/results/QuestionResult";
import type { PostGroup } from "@/lib/community";
import { colors, fontSize, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { formatPoints } from "@/lib/format";
import type { GroupDim } from "@/lib/hub";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

// get_today_daily (a·b·groups는 답한 뒤에만)
export type Daily = {
  id: number;
  question: string;
  option_a: string;
  option_b: string;
  my_choice: "a" | "b" | null;
  a: number | null;
  b: number | null;
  streak: number;
  reward: number;
  streak_days: number;
  streak_bonus: number;
  rewarded: boolean;
  comment_count: number;
  groups: Record<GroupDim, PostGroup[]> | null;
};

type Props = {
  onAnswered?: () => void;
  // 홈: 카드를 누르면 오늘 질문 상세(그룹별·댓글)로
  onOpen?: () => void;
  // 상세 화면: 불러올 때마다 데이터를 넘겨받아 그룹별 결과를 그린다
  onLoaded?: (daily: Daily | null) => void;
};

// "오늘의 질문": A/B 중 하나 → 바로 비율 + 출석 포인트. 오늘 질문이 없으면 아무것도 그리지 않는다
export default function DailyCard({ onAnswered, onOpen, onLoaded }: Props) {
  const [daily, setDaily] = useState<Daily | null>(null);
  const [sending, setSending] = useState(false);
  // 방금 받은 포인트 (출석 + 보너스) — 답한 직후 한 번만 보여 준다
  const [earned, setEarned] = useState<{ reward: number; bonus: number } | null>(null);

  const load = useCallback(() => {
    supabase.rpc("get_today_daily").then(({ data }) => {
      const d = (data as Daily | null) ?? null;
      setDaily(d);
      onLoaded?.(d);
    });
  }, [onLoaded]);

  useFocusEffect(load);

  if (!daily) return null;

  const answer = async (choice: "a" | "b") => {
    if (sending || daily.my_choice) return;
    setSending(true);
    const { data, error } = await supabase.rpc("answer_daily", { p_choice: choice });
    setSending(false);
    if (error) {
      showNotice("답하지 못했어요", errorMessage(error));
      load();
      return;
    }
    const result = data as { reward: number; bonus: number };
    setEarned({ reward: result.reward, bonus: result.bonus });
    load();
    onAnswered?.();
  };

  const answered = daily.my_choice !== null;
  const total = (daily.a ?? 0) + (daily.b ?? 0);
  // 다음 보너스까지 남은 날
  const toBonus = daily.streak_days - (daily.streak % daily.streak_days);

  return (
    <Pressable style={styles.card} onPress={onOpen} disabled={!onOpen}>
      <Text style={styles.eyebrow}>오늘의 질문</Text>
      <Text style={styles.question}>{daily.question}</Text>

      {answered ? (
        <View style={styles.results}>
          {(["a", "b"] as const).map((key) => {
            const label = key === "a" ? daily.option_a : daily.option_b;
            const pct = percent((key === "a" ? daily.a : daily.b) ?? 0, total);
            const mine = daily.my_choice === key;
            return (
              <View key={key} style={styles.resultRow}>
                <View style={styles.resultLabels}>
                  <Text style={[styles.resultLabel, mine && styles.mine]}>
                    {label}
                    {mine ? "  ✓ 내 선택" : ""}
                  </Text>
                  <Text style={[styles.resultPct, mine && styles.mine]}>{pct}%</Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, mine && styles.fillMine, { width: `${pct}%` }]} />
                </View>
              </View>
            );
          })}
          <Text style={styles.meta}>{total}명 참여</Text>
        </View>
      ) : (
        <View style={styles.buttons}>
          {(["a", "b"] as const).map((key) => (
            <Pressable
              key={key}
              style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
              onPress={() => answer(key)}
              disabled={sending}
            >
              <Text style={styles.choiceText}>{key === "a" ? daily.option_a : daily.option_b}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {daily.rewarded && (
        <Text style={styles.streak}>
          {answered
            ? `🔥 연속 ${daily.streak}일째` +
              (earned ? ` · +${formatPoints(earned.reward + earned.bonus)}${earned.bonus > 0 ? " (연속 보너스 포함)" : ""}` : "") +
              (toBonus < daily.streak_days ? ` · ${toBonus}일 더 하면 +${formatPoints(daily.streak_bonus)}` : "")
            : `답하면 +${formatPoints(daily.reward)} · ${daily.streak_days}일 연속이면 +${formatPoints(daily.streak_bonus)}` +
              (daily.streak > 0 ? ` · 지금 연속 ${daily.streak}일` : "")}
        </Text>
      )}

      {onOpen && (
        <Text style={styles.more}>
          {daily.comment_count > 0 ? `댓글 ${daily.comment_count} · ` : ""}
          {answered ? "그룹별 결과 · 댓글 보기 ›" : "댓글 보기 ›"}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.sm,
  },
  eyebrow: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.primary,
  },
  question: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  buttons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  choice: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  choicePressed: {
    borderColor: colors.primary,
  },
  choiceText: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.text,
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
  },
  resultLabel: {
    fontSize: fontSize.small,
    color: colors.text,
  },
  resultPct: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  mine: {
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
  meta: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  streak: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  more: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.primary,
    textAlign: "right",
  },
});
