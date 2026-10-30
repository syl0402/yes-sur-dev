import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import Chips from "@/components/create/Chips";
import QuestionResult, { Bar, percent, type QuestionStats } from "@/components/results/QuestionResult";
import { colors, fontSize, spacing } from "@/constants/theme";
import { aggregateCsv, csvFileName, shareCsv } from "@/lib/csv";
import { formatDate, formatPoints } from "@/lib/format";
import { type FullResults, GROUP_DIMS, type GroupDim, sortGroups } from "@/lib/hub";
import { showNotice } from "@/lib/notice";
import { biggestGap, formatSeconds, questionLine } from "@/lib/resultSummary";

type Dim = "all" | GroupDim;

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

// 전체 결과 (ys-131 열람 후 · ys-121 등록자): 신뢰 정보 → 핵심 요약 → 출처 복사 → 나눠 보기 → 문항별 결과
export default function ResultsView({ full, title, host, questions = full.overall, showEarnings = true }: Props) {
  const [dim, setDim] = useState<Dim>("all");

  if (full.total === 0) return <Text style={styles.muted}>결과에 반영된 응답이 없어요.</Text>;

  const period = `${formatDate(full.started_at)}~${formatDate(full.ended_at)}`;
  const gap = biggestGap(full);

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
      {/* 신뢰 정보 */}
      <View style={styles.box}>
        <Text style={styles.boxTitle}>응답 정보</Text>
        <Text style={styles.body}>
          유효 응답 {full.total}명{full.excluded > 0 ? ` (확인 문항 오답 ${full.excluded}건 제외)` : ""}
        </Text>
        {full.pass_rate !== null && <Text style={styles.body}>확인 문항 통과율 {full.pass_rate}%</Text>}
        {full.avg_seconds !== null && <Text style={styles.body}>평균 응답 시간 {formatSeconds(full.avg_seconds)}</Text>}
        <Text style={styles.body}>조사 기간 {period}</Text>
        {full.share_earned !== null && (
          <Text style={styles.earned}>
            열람 {full.view_count}회{showEarnings ? ` · 열람 수익 +${formatPoints(full.share_earned)}` : ""}
          </Text>
        )}
      </View>

      {/* 핵심 요약 (규칙으로 만든 문장) */}
      <View style={styles.box}>
        <Text style={styles.boxTitle}>핵심 요약</Text>
        {full.overall.map((q, i) => {
          const line = questionLine(q);
          return line ? (
            <Text key={q.id} style={styles.body}>
              <Text style={styles.label}>{i + 1}번  </Text>
              {line}
            </Text>
          ) : null;
        })}
        {gap && (
          <View style={styles.gap}>
            <Text style={styles.gapTitle}>{gap.title}</Text>
            <Text style={styles.body}>{gap.detail}</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.copyButton} onPress={copyCitation}>
          <Text style={styles.copyText}>출처 복사</Text>
        </Pressable>
        <Pressable style={styles.copyButton} onPress={downloadCsv}>
          <Text style={styles.copyText}>집계 CSV 받기</Text>
        </Pressable>
      </View>

      {/* 나눠 보기 */}
      <Chips
        options={[{ value: "all" as Dim, label: "전체" }, ...GROUP_DIMS.map((d) => ({ value: d.value as Dim, label: d.label }))]}
        selected={dim}
        onSelect={setDim}
      />

      {dim === "all"
        ? questions.map((q, index) => <QuestionResult key={q.id} index={index} question={q} />)
        : full.overall.map((q, index) => <GroupedQuestion key={q.id} index={index} question={q} full={full} dim={dim} />)}
    </>
  );
}

// 문항 하나를 그룹별로: 그룹 이름(인원) 아래 막대. 5명 미만 그룹은 숨김
function GroupedQuestion({ index, question: q, full, dim }: { index: number; question: QuestionStats; full: FullResults; dim: GroupDim }) {
  return (
    <View style={styles.box}>
      <Text style={styles.boxTitle}>
        {index + 1}. {q.text}
      </Text>
      {q.type === "text" ? (
        <Text style={styles.label}>주관식은 나눠 보기를 하지 않아요.</Text>
      ) : (
        sortGroups(dim, full.groups[dim]).map((g) => {
          const s = g.questions.find((x) => x.id === q.id);
          if (g.hidden || !s) {
            return (
              <Text key={g.label} style={styles.label}>
                {g.label}: 5명 미만이라 숨겼어요
              </Text>
            );
          }
          return (
            <View key={g.label} style={styles.group}>
              <Text style={styles.groupTitle}>
                {g.label} ({g.n}명)
              </Text>
              {q.type === "scale" ? (
                <Text style={styles.body}>평균 {s.scale?.avg ?? "-"}점</Text>
              ) : (
                s.options.map((o) => <Bar key={o.id} label={o.text} count={o.count} pct={percent(o.count, s.answered)} />)
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    gap: spacing.sm,
  },
  boxTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  body: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  label: {
    fontSize: fontSize.small,
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
  gap: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 2,
  },
  gapTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.primary,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  copyButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    alignItems: "center",
  },
  copyText: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.primary,
  },
  group: {
    gap: 4,
    paddingTop: spacing.sm,
  },
  groupTitle: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.text,
  },
});
