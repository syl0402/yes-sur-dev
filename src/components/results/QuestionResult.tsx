import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, shadow, spacing } from "@/constants/theme";
import { type QuestionType, SCALE_LABELS } from "@/lib/surveyDraft";

// 서버 집계 함수(get_survey_results·get_full_results)가 돌려주는 문항 하나의 모양
export type QuestionStats = {
  id: number;
  type: QuestionType;
  text: string;
  answered: number;
  options: { id: number; text: string; count: number }[];
  scale: { avg: number | null; counts: number[] } | null;
  // 주관식 답 원문 (등록자에게만 온다)
  texts?: string[];
};

// 비율(%) 정수
export function percent(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

// 문항 하나의 결과 카드: 고르기 = 막대, 척도 = 평균 + 1~5 막대, 주관식 = 답 목록(등록자) 또는 안내
export default function QuestionResult({ index, question }: { index: number; question: QuestionStats }) {
  const q = question;
  return (
    <View style={styles.card}>
      <Text style={styles.questionText}>
        {index + 1}. {q.text}
      </Text>
      <Text style={styles.hint}>응답 {q.answered}개</Text>

      {(q.type === "single" || q.type === "multi") &&
        q.options.map((o) => <Bar key={o.id} label={o.text} count={o.count} pct={percent(o.count, q.answered)} />)}

      {q.type === "scale" && q.scale && (
        <>
          <Text style={styles.average}>평균 {q.scale.avg ?? "-"}점</Text>
          {q.scale.counts.map((count, i) => (
            <Bar key={i} label={`${i + 1} ${SCALE_LABELS[i]}`} count={count} pct={percent(count, q.answered)} />
          ))}
        </>
      )}

      {q.type === "text" &&
        (q.texts ? (
          q.texts.map((t, i) => (
            <Text key={i} style={styles.textAnswer}>
              {t}
            </Text>
          ))
        ) : (
          <Text style={styles.hint}>주관식 답은 등록자만 볼 수 있어요.</Text>
        ))}
    </View>
  );
}

// 가로 막대 한 줄: 보기 이름 · 막대 · 명(%)
export function Bar({ label, count, pct }: { label: string; count: number; pct: number }) {
  return (
    <View style={styles.barRow}>
      <View style={styles.barLabels}>
        <Text style={styles.barLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.barCount}>
          {count}명 ({pct}%)
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.sm,
    ...shadow.card,
  },
  questionText: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  hint: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  average: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.primary,
  },
  barRow: {
    gap: 4,
  },
  barLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  barLabel: {
    flex: 1,
    fontSize: fontSize.small,
    color: colors.text,
  },
  barCount: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  barTrack: {
    height: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
  textAnswer: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    fontSize: fontSize.body,
    color: colors.text,
  },
});
