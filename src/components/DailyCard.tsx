import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import BalanceBar, { duelPcts } from "@/components/community/BalanceBar";
import AppIcon from "@/components/AppIcon";
import { Text } from "@/components/ui/Text";
import { uiIcons } from "@/constants/icons";
import type { PostGroup } from "@/lib/community";
import { colors, fontSize, radius, shadow, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { formatPoints } from "@/lib/format";
import type { GroupDim } from "@/lib/hub";
import { showConfirm } from "@/lib/confirm";
import { showNotice } from "@/lib/notice";
import { enablePush, markPushAsked, shouldAskPush } from "@/lib/push";
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
  // 커뮤니티 탭: 작게 (질문 + 답 버튼 2개 / 답했으면 얇은 결과 막대 2줄, 2026-11-03)
  compact?: boolean;
  // 홈 팝업 안: 그림자·"오늘의 질문" 표시 없이 (팝업 제목과 겹치지 않게, 2026-11-10)
  bare?: boolean;
};

// "오늘의 질문": A/B 중 하나 → 바로 비율 + 출석 포인트. 오늘 질문이 없으면 아무것도 그리지 않는다
export default function DailyCard({ onAnswered, onOpen, onLoaded, compact, bare }: Props) {
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
    // 처음 답한 직후 한 번만: 매일 알림 받을지 (2026-11-10, 앱 켤 때 묻는 것보다 허용률이 높음)
    if (await shouldAskPush()) {
      markPushAsked();
      showConfirm({
        title: "매일 오늘의 질문 알림을 받을까요?",
        message: "낮 12시, 아직 답하지 않았을 때만 한 번 보내요. 내 정보에서 언제든 끌 수 있어요.",
        okLabel: "받을게요",
        cancelLabel: "나중에",
        onOk: () => {
          enablePush();
        },
      });
    }
  };

  const answered = daily.my_choice !== null;
  const total = (daily.a ?? 0) + (daily.b ?? 0);
  // 다음 보너스까지 남은 날
  const toBonus = daily.streak_days - (daily.streak % daily.streak_days);

  if (compact) {
    return (
      <Pressable style={[styles.card, styles.compactCard]} onPress={onOpen} disabled={!onOpen}>
        <View style={styles.compactTop}>
          <Text style={styles.eyebrow}>오늘의 질문</Text>
          {daily.rewarded && daily.streak > 0 && (
            <View style={styles.streakLine}>
              <AppIcon name={uiIcons.streak} size={13} color={colors.hot} />
              <Text style={styles.compactStreak}>연속 {daily.streak}일</Text>
            </View>
          )}
          <Text style={styles.compactMore}>
            {daily.comment_count > 0 ? `댓글 ${daily.comment_count} ` : ""}›
          </Text>
        </View>
        <Text style={styles.compactQuestion} numberOfLines={2}>
          {daily.question}
        </Text>
        {answered ? (
          <View style={styles.compactResults}>
            {/* 밸런스와 같은 A vs B 막대 (방금 답했으면 커튼 열리듯, 2026-11-10) */}
            <BalanceBar
              labels={[daily.option_a, daily.option_b]}
              pcts={duelPcts(daily.a ?? 0, daily.b ?? 0)}
              myChoice={daily.my_choice === "a" ? 0 : daily.my_choice === "b" ? 1 : null}
              animate={earned !== null}
            />
            <Text style={styles.compactMeta}>
              {total}명 참여
              {earned ? ` · +${formatPoints(earned.reward + earned.bonus)} 받았어요` : ""}
            </Text>
          </View>
        ) : (
          <View style={styles.buttons}>
            {(["a", "b"] as const).map((key) => (
              <Pressable
                key={key}
                style={({ pressed }) => [styles.choice, styles.compactChoice, pressed && styles.choicePressed]}
                onPress={() => answer(key)}
                disabled={sending}
              >
                <Text style={styles.choiceText} numberOfLines={1}>
                  {key === "a" ? daily.option_a : daily.option_b}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable style={[styles.card, bare && styles.bareCard]} onPress={onOpen} disabled={!onOpen}>
      {!bare && <Text style={styles.eyebrow}>오늘의 질문</Text>}
      <Text style={styles.question}>{daily.question}</Text>

      {answered ? (
        <View style={styles.results}>
          <BalanceBar
            labels={[daily.option_a, daily.option_b]}
            pcts={duelPcts(daily.a ?? 0, daily.b ?? 0)}
            myChoice={daily.my_choice === "a" ? 0 : daily.my_choice === "b" ? 1 : null}
            animate={earned !== null}
          />
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
        <View style={styles.streakLine}>
          {answered && <AppIcon name={uiIcons.streak} size={14} color={colors.hot} />}
        <Text style={styles.streak}>
          {answered
            ? `연속 ${daily.streak}일째` +
              (earned ? ` · +${formatPoints(earned.reward + earned.bonus)}${earned.bonus > 0 ? " (연속 보너스 포함)" : ""}` : "") +
              (toBonus < daily.streak_days ? ` · ${toBonus}일 더 하면 +${formatPoints(daily.streak_bonus)}` : "")
            : `답하면 +${formatPoints(daily.reward)} · ${daily.streak_days}일 연속이면 +${formatPoints(daily.streak_bonus)}` +
              (daily.streak > 0 ? ` · 지금 연속 ${daily.streak}일` : "")}
        </Text>
        </View>
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
  streakLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
    ...shadow.card,
  },
  // 팝업 안: 테두리는 두고 그림자만 뺀다 (팝업 위에 그림자가 겹치면 지저분, 2026-11-10 폰 확인 피드백)
  bareCard: {
    shadowOpacity: 0,
    elevation: 0,
  },
  eyebrow: {
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    fontSize: fontSize.caption,
    fontWeight: "700",
    color: colors.onAccentSoft,
    overflow: "hidden",
  },
  question: {
    fontSize: fontSize.subtitle,
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
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
  },
  choicePressed: {
    opacity: 0.7,
  },
  choiceText: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.primary,
    textAlign: "center",
  },
  results: {
    gap: spacing.sm,
  },
  meta: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  streak: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  compactCard: {
    gap: spacing.xs,
    paddingVertical: spacing.sm + spacing.xs,
  },
  compactTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  compactStreak: {
    flex: 1,
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  compactMore: {
    marginLeft: "auto",
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.primary,
  },
  compactQuestion: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  compactResults: {
    gap: 6,
  },
  compactMeta: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  compactChoice: {
    paddingVertical: spacing.sm + 2,
  },
  more: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.primary,
    textAlign: "right",
  },
});
