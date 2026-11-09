import { StyleSheet, View } from "react-native";

import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { QUESTION_TYPE_LABELS, type QuestionType, SCALE_LABELS } from "@/lib/surveyDraft";

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
  // 고르기 문항에서 "기타 (직접 입력)"에 적은 글 (등록자에게만 온다, 2026-11-10)
  other_texts?: string[];
};

// 비율(%) 정수
export function percent(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

// 문항 머리: [Q1] 하나 고르기 ······ 응답 63 / 질문
export function QuestionHeader({ index, question: q, right }: { index: number; question: QuestionStats; right?: string }) {
  return (
    <>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <Badge label={`Q${index + 1}`} />
          <Text style={styles.type}>{QUESTION_TYPE_LABELS[q.type]}</Text>
        </View>
        <Text style={styles.type}>{right ?? `응답 ${q.answered}`}</Text>
      </View>
      <Text style={styles.questionText}>{q.text}</Text>
    </>
  );
}

// 문항 하나의 결과: 고르기 = 막대(1위 강조) + 기타에 적은 글(등록자), 척도 = 평균 + 1~5 분포, 주관식 = 답 목록(등록자) 또는 안내
export function QuestionBody({ question: q }: { question: QuestionStats }) {
  if (q.type === "single" || q.type === "multi") {
    const max = Math.max(0, ...q.options.map((o) => o.count));
    return (
      <View style={styles.bars}>
        {q.options.map((o) => (
          <Bar key={o.id} label={o.text} count={o.count} pct={percent(o.count, q.answered)} top={max > 0 && o.count === max} />
        ))}
        {q.other_texts && q.other_texts.length > 0 && (
          <View style={styles.otherBox}>
            <Text style={styles.type}>기타에 적은 글 {q.other_texts.length}개 · 나만 볼 수 있어요</Text>
            {q.other_texts.map((t, i) => (
              <Text key={i} style={styles.textAnswer}>
                {t}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  }
  if (q.type === "scale" && q.scale) {
    const max = Math.max(0, ...q.scale.counts);
    return (
      <View style={styles.bars}>
        <Text style={styles.average}>
          {q.scale.avg ?? "-"}
          <Text style={styles.averageUnit}> / 5점</Text>
        </Text>
        {q.scale.counts.map((count, i) => (
          <Bar key={i} label={`${i + 1} ${SCALE_LABELS[i]}`} count={count} pct={percent(count, q.answered)} top={max > 0 && count === max} />
        ))}
      </View>
    );
  }
  if (q.type === "text") {
    return q.texts ? (
      <View style={styles.bars}>
        {q.texts.map((t, i) => (
          <Text key={i} style={styles.textAnswer}>
            {t}
          </Text>
        ))}
      </View>
    ) : (
      <Text style={styles.type}>주관식 답은 등록자만 볼 수 있어요.</Text>
    );
  }
  return null;
}

// 문항 결과 카드
export default function QuestionResult({ index, question }: { index: number; question: QuestionStats }) {
  return (
    <Card>
      <QuestionHeader index={index} question={question} />
      <QuestionBody question={question} />
    </Card>
  );
}

// 가로 막대 한 줄: 보기 이름 · 명(%) / 막대. top이면 진한 파랑 + 굵은 글자
export function Bar({ label, count, pct, top }: { label: string; count: number; pct: number; top?: boolean }) {
  return (
    <View style={styles.barRow}>
      <View style={styles.barLabels}>
        <Text style={[styles.barLabel, top && styles.barLabelTop]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.barCount, top && styles.barCountTop]}>
          {pct}% <Text style={styles.barN}>· {count}명</Text>
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, top && styles.barFillTop, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  type: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  questionText: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 23,
  },
  bars: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  average: {
    fontSize: fontSize.hero,
    fontWeight: "800",
    color: colors.primary,
  },
  averageUnit: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.textMuted,
  },
  otherBox: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  textAnswer: {
    fontSize: fontSize.small,
    color: colors.text,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
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
  barLabelTop: {
    fontWeight: "700",
  },
  barCount: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.textMuted,
  },
  barCountTop: {
    color: colors.primary,
    fontWeight: "800",
  },
  barN: {
    fontSize: fontSize.caption,
    fontWeight: "400",
    color: colors.textSubtle,
  },
  barTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMuted,
  },
  barFillTop: {
    backgroundColor: colors.primary,
  },
});
