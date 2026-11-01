import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import CompositionChart from "@/components/results/CompositionChart";
import InsightCard from "@/components/results/InsightCard";
import QuestionResult, { Bar, QuestionHeader, percent, type QuestionStats } from "@/components/results/QuestionResult";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import Segmented from "@/components/ui/Segmented";
import StatTile from "@/components/ui/StatTile";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { aggregateCsv, csvFileName, shareCsv } from "@/lib/csv";
import { formatDate, formatPoints } from "@/lib/format";
import { type FullResults, GROUP_DIMS, type GroupDim, sortGroups } from "@/lib/hub";
import { showNotice } from "@/lib/notice";
import { buildInsights, formatSeconds } from "@/lib/resultSummary";

type Tab = "questions" | "people" | "info";
type Dim = "all" | GroupDim;

const TABS: { value: Tab; label: string }[] = [
  { value: "questions", label: "문항별 결과" },
  { value: "people", label: "응답자" },
  { value: "info", label: "조사 정보" },
];

type Props = {
  full: FullResults;
  // 출처 복사에 들어갈 설문 이름·주최
  title: string;
  host: string;
  // 등록자 화면: 주관식 원문이 든 문항 (없으면 full.overall)
  questions?: QuestionStats[];
  // 등록자의 열람 수익 표시 (단체는 포인트를 쓰지 않아 열람 수만)
  showEarnings?: boolean;
};

// 전체 결과 (ys-131 열람 후 · ys-121 등록자): 핵심 인사이트 → 탭 [문항별 결과 | 응답자 | 조사 정보] (2026-11-01 정리)
export default function ResultsView({ full, title, host, questions = full.overall, showEarnings = true }: Props) {
  const [tab, setTab] = useState<Tab>("questions");
  const [dim, setDim] = useState<Dim>("all");

  if (full.total === 0) return <Text style={styles.muted}>결과에 반영된 응답이 없어요.</Text>;

  const period = `${formatDate(full.started_at)}~${formatDate(full.ended_at)}`;
  // 숫자 카드용 짧은 기간 "10.16~10.23"
  const shortPeriod = `${formatDate(full.started_at).slice(5)}~${formatDate(full.ended_at).slice(5)}`;

  const copyCitation = async () => {
    const text = `출처: 옛썰 설문 「${title}」(${host}, 유효 응답 ${full.total}명, ${period} 조사)`;
    await Clipboard.setStringAsync(text);
    showNotice("출처를 복사했어요", text);
  };

  // 집계 CSV (화면에 보이는 것과 같은 내용, 5명 미만 그룹은 숨김)
  const downloadCsv = () =>
    shareCsv(csvFileName(title, "집계"), aggregateCsv(full)).catch(() =>
      showNotice("파일을 만들지 못했어요", "잠시 후 다시 시도해 주세요."),
    );

  return (
    <>
      <InsightCard insights={buildInsights(full)} />

      <Segmented options={TABS} value={tab} onChange={setTab} />

      {tab === "questions" && (
        <>
          {/* 나눠 보는 기준 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="전체" selected={dim === "all"} onPress={() => setDim("all")} />
            {GROUP_DIMS.map((d) => (
              <Chip key={d.value} label={d.label} selected={dim === d.value} onPress={() => setDim(d.value)} />
            ))}
          </ScrollView>

          {dim === "all"
            ? questions.map((q, index) => <QuestionResult key={q.id} index={index} question={q} />)
            : full.overall.map((q, index) => (
                <GroupedQuestion key={q.id} index={index} question={q} full={full} dim={dim} />
              ))}
        </>
      )}

      {tab === "people" && <CompositionChart groups={full.groups} />}

      {tab === "info" && (
        <>
          <View style={styles.tiles}>
            <StatTile label="유효 응답" value={`${full.total}명`} />
            <StatTile label="확인 문항 통과율" value={full.pass_rate !== null ? `${full.pass_rate}%` : "-"} />
          </View>
          <View style={styles.tiles}>
            <StatTile label="평균 응답 시간" value={full.avg_seconds !== null ? formatSeconds(full.avg_seconds) : "-"} />
            <StatTile label="조사 기간" value={shortPeriod} />
          </View>
          <Card>
            {full.excluded > 0 && <Text style={styles.body}>확인 문항 오답 {full.excluded}건은 결과에서 뺐어요.</Text>}
            <Text style={styles.body}>조사 기간 {period}</Text>
            {full.share_earned !== null && (
              <Text style={styles.earned}>
                열람 {full.view_count}회{showEarnings ? ` · 열람 수익 +${formatPoints(full.share_earned)}` : ""}
              </Text>
            )}
          </Card>
          <View style={styles.actions}>
            <Button title="출처 복사" variant="outline" onPress={copyCitation} style={styles.action} />
            <Button title="집계 CSV 받기" variant="outline" onPress={downloadCsv} style={styles.action} />
          </View>
        </>
      )}
    </>
  );
}

// 문항 하나를 그룹별로: 그룹마다 작은 묶음. 5명 미만 그룹은 맨 아래 한 줄로 모은다
function GroupedQuestion({ index, question: q, full, dim }: { index: number; question: QuestionStats; full: FullResults; dim: GroupDim }) {
  const groups = sortGroups(dim, full.groups[dim]);
  const shown = groups
    .map((g) => ({ g, s: g.questions.find((x) => x.id === q.id) }))
    .filter((r): r is { g: (typeof groups)[number]; s: QuestionStats } => !r.g.hidden && !!r.s);
  const hidden = groups.filter((g) => g.hidden);

  return (
    <Card>
      <QuestionHeader index={index} question={q} />
      {q.type === "text" ? (
        <Text style={styles.label}>주관식은 나눠 보기를 하지 않아요.</Text>
      ) : (
        shown.map(({ g, s }) => {
          const max = Math.max(0, ...s.options.map((o) => o.count));
          return (
            <View key={g.label} style={styles.group}>
              <Text style={styles.groupTitle}>
                {g.label} <Text style={styles.groupN}>{g.n}명</Text>
              </Text>
              {q.type === "scale" ? (
                <Text style={styles.groupAvg}>평균 {s.scale?.avg ?? "-"}점</Text>
              ) : (
                s.options.map((o) => (
                  <Bar key={o.id} label={o.text} count={o.count} pct={percent(o.count, s.answered)} top={max > 0 && o.count === max} />
                ))
              )}
            </View>
          );
        })
      )}
      {q.type !== "text" && hidden.length > 0 && (
        <Text style={styles.label}>5명 미만이라 숨김: {hidden.map((g) => g.label).join(", ")}</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  chips: {
    gap: spacing.sm,
  },
  tiles: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  body: {
    fontSize: fontSize.small,
    color: colors.text,
  },
  label: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  muted: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: "center",
  },
  earned: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.primary,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
  group: {
    gap: 6,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  groupTitle: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.text,
  },
  groupN: {
    fontSize: fontSize.caption,
    fontWeight: "400",
    color: colors.textMuted,
  },
  groupAvg: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.primary,
  },
});
