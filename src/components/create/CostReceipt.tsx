// 등록비 계산표 (작성 ③ 목표 인원, 2026-11-09 피드백: 문장이 줄줄이 붙어 난잡 → 결제 요약처럼 위에서 아래로)
// 응답 1명당 × 목표 인원 = 등록비 → 내 포인트 → 남는(모자란) 포인트. 실제 차감은 서버가 정한다
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { BANDS, bandOf } from "@/lib/pointBands";
import { type SurveyDraft, estimate } from "@/lib/surveyDraft";

type Props = {
  draft: SurveyDraft;
  rules: Record<string, number>;
  target: number;
  balance: number;
};

export default function CostReceipt({ draft, rules, target, balance }: Props) {
  const count = draft.questions.length;
  const { minutes, price } = estimate(draft, rules);
  const band = BANDS.find((b) => b.key === bandOf(count, minutes))?.label ?? "";
  // 1문항은 구간 이름도 "1문항"이라 겹치지 않게
  const lengthText = count === 1 ? "1문항 설문" : `${band} (${count}문항, 약 ${minutes}분)`;
  const cost = price * target;
  const left = balance - cost;

  return (
    <View style={styles.box}>
      <Line label={`응답 1명당 · ${lengthText}`} value={formatPoints(price)} />
      <Line label="목표 인원" value={`× ${target}명`} />
      <View style={styles.divider} />
      <Line label="등록비" value={formatPoints(cost)} strong />
      <Line label="내 포인트" value={formatPoints(balance)} muted />
      <View style={styles.divider} />
      {left >= 0 ? (
        <Line label="등록 후 남는 포인트" value={formatPoints(left)} tone="ok" />
      ) : (
        <>
          <Line label="모자란 포인트" value={formatPoints(-left)} tone="bad" />
          <Text style={styles.help}>
            인원을 줄이거나, 다른 설문에 응답해 포인트를 더 모아 보세요. 쓰던 내용은 임시저장할 수 있어요.
          </Text>
        </>
      )}
    </View>
  );
}

function Line({
  label,
  value,
  strong,
  muted,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  tone?: "ok" | "bad";
}) {
  return (
    <View style={styles.line}>
      <Text style={[styles.label, muted && styles.muted]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[
          styles.value,
          strong && styles.strong,
          muted && styles.muted,
          tone === "ok" && styles.ok,
          tone === "bad" && styles.bad,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: 6,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  line: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  label: {
    flexShrink: 1,
    fontSize: fontSize.small,
    color: colors.text,
  },
  value: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.text,
  },
  strong: {
    fontSize: fontSize.body,
    fontWeight: "800",
  },
  muted: {
    color: colors.textMuted,
    fontWeight: "400",
  },
  ok: {
    color: colors.onAccentSoft,
  },
  bad: {
    color: colors.danger,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  help: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
});
