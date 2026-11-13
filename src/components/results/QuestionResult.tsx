// 문항 하나의 결과 (2026-11-10 정리: 데이터 시각화 원칙)
// - 고르기: 가장 많은 답 하나만 파랑, 나머지는 회색 (강조). 숫자는 글자색
// - 5점 척도: 큰 평균 + 1~5점 세로 막대 (분포)
import { StyleSheet, View } from "react-native";

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
    <View style={styles.headBox}>
      <View style={styles.head}>
        <Text style={styles.type}>
          <Text style={styles.qNo}>Q{index + 1}</Text> · {QUESTION_TYPE_LABELS[q.type]}
        </Text>
        <Text style={styles.type}>{right ?? `응답 ${q.answered}명`}</Text>
      </View>
      <Text style={styles.questionText}>{q.text}</Text>
    </View>
  );
}

// 문항 하나의 결과 본문
export function QuestionBody({ question: q }: { question: QuestionStats }) {
  if (q.type === "single" || q.type === "multi") {
    const max = Math.max(0, ...q.options.map((o) => o.count));
    return (
      <View style={styles.body}>
        {q.options.map((o) => (
          <Bar key={o.id} label={o.text} count={o.count} pct={percent(o.count, q.answered)} top={max > 0 && o.count === max} />
        ))}
        {q.type === "multi" && <Text style={styles.countLine}>여러 개 고를 수 있어서 합이 100%를 넘을 수 있어요</Text>}
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
    return <ScaleChart avg={q.scale.avg} counts={q.scale.counts} answered={q.answered} />;
  }
  if (q.type === "text") {
    return q.texts ? (
      <View style={styles.body}>
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

// 가로 막대 한 줄: 보기 이름 ····· 48% 30명 / 막대. top이면 파랑 막대 + 굵은 글자, 아니면 회색 막대
export function Bar({ label, count, pct, top }: { label: string; count: number; pct: number; top?: boolean }) {
  return (
    <View style={styles.barRow}>
      <View style={styles.barLabels}>
        <Text style={[styles.barLabel, top && styles.barLabelTop]} numberOfLines={2}>
          {label}
        </Text>
        <Text style={[styles.barPct, top && styles.barPctTop]}>
          {pct}%<Text style={styles.barN}>  {count}명</Text>
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, top && styles.barFillTop, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

// 5점 척도: 왼쪽 큰 평균 + 오른쪽 1~5점 세로 막대 (가장 많은 점수만 파랑)
function ScaleChart({ avg, counts, answered }: { avg: number | null; counts: number[]; answered: number }) {
  const pcts = counts.map((c) => percent(c, answered));
  const maxPct = Math.max(1, ...pcts);
  const maxCount = Math.max(0, ...counts);
  return (
    <View style={styles.scale}>
      <View style={styles.scaleTop}>
        <Text style={styles.average}>{avg ?? "-"}</Text>
        <Text style={styles.averageUnit}>/ 5점 평균</Text>
      </View>
      <View style={styles.columns}>
        {counts.map((c, i) => {
          const top = maxCount > 0 && c === maxCount;
          return (
            <View key={i} style={styles.column}>
              <Text style={[styles.colPct, top && styles.colPctTop]}>{pcts[i]}%</Text>
              <View style={styles.colTrack}>
                <View style={[styles.colFill, top && styles.barFillTop, { height: `${(pcts[i] / maxPct) * 100}%` }]} />
              </View>
              <Text style={[styles.colLabel, top && styles.colLabelTop]}>{i + 1}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.scaleEnds}>
        <Text style={styles.scaleEnd}>{SCALE_LABELS[0]}</Text>
        <Text style={styles.scaleEnd}>{SCALE_LABELS[SCALE_LABELS.length - 1]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headBox: {
    gap: 10,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  qNo: {
    fontWeight: "800",
    color: colors.primary,
  },
  type: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  questionText: {
    fontSize: fontSize.body,
    fontWeight: "800",
    color: colors.text,
    lineHeight: 23,
  },
  body: {
    gap: 14,
    marginTop: spacing.xs,
  },
  countLine: {
    fontSize: fontSize.caption,
    color: colors.textSubtle,
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
  // 가로 막대
  barRow: {
    gap: 6,
  },
  barLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  barLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.textMuted,
  },
  barLabelTop: {
    fontWeight: "700",
    color: colors.text,
  },
  barPct: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
  },
  barPctTop: {
    fontWeight: "800",
    color: colors.text,
  },
  barN: {
    fontSize: fontSize.caption,
    fontWeight: "400",
    color: colors.textSubtle,
  },
  barTrack: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.chartMuted,
  },
  barFillTop: {
    backgroundColor: colors.primary,
  },
  // 5점 척도
  scale: {
    gap: 12,
    marginTop: spacing.xs,
  },
  scaleTop: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  average: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.text,
  },
  averageUnit: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.textMuted,
  },
  columns: {
    flexDirection: "row",
    gap: 10,
  },
  column: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  colPct: {
    fontSize: fontSize.caption,
    fontWeight: "600",
    color: colors.textMuted,
  },
  colPctTop: {
    fontWeight: "800",
    color: colors.text,
  },
  colTrack: {
    width: "100%",
    height: 72,
    justifyContent: "flex-end",
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  colFill: {
    width: "100%",
    borderRadius: 6,
    backgroundColor: colors.chartMuted,
  },
  colLabel: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  colLabelTop: {
    fontWeight: "700",
    color: colors.text,
  },
  scaleEnds: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  scaleEnd: {
    fontSize: 11,
    color: colors.textSubtle,
  },
});
