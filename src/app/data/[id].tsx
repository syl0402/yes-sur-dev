// ys-131 결과 상세 · F-502~504 (무료 정보 → 내 답 비교 → 열람 → 전체 결과. 2026-11-01 정리: 뱃지 머리 · 구성 차트 · 아래 고정 열람 버튼)
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import ReportLink from "@/components/ReportLink";
import CompositionChart from "@/components/results/CompositionChart";
import ResultsView from "@/components/results/ResultsView";
import Badge from "@/components/ui/Badge";
import BottomBar from "@/components/ui/BottomBar";
import Card from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import { showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatPoints } from "@/lib/format";
import {
  type Comparison,
  FREE_REASON_LABELS,
  type FullResults,
  type HubPreview,
} from "@/lib/hub";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";
import { QUESTION_TYPE_LABELS, SCALE_LABELS } from "@/lib/surveyDraft";
import { formatHost } from "@/lib/surveys";

type Loaded = {
  preview: HubPreview;
  comparison: Comparison[] | null;
  full: FullResults | null;
};

// 무료 정보 + (응답자면) 내 답 비교 + (열람했으면) 전체 결과
async function fetchAll(id: number): Promise<Loaded | string> {
  const { data, error } = await supabase.rpc("get_hub_preview", { p_survey_id: id });
  if (error) return errorMessage(error);
  const preview = data as HubPreview;

  const canSeeFull = preview.viewed || preview.mine;
  const [comparison, full] = await Promise.all([
    preview.answered && !canSeeFull
      ? supabase.rpc("get_my_comparison", { p_survey_id: id }).then(({ data }) => data as Comparison[])
      : Promise.resolve(null),
    canSeeFull
      ? supabase.rpc("get_full_results", { p_survey_id: id }).then(({ data }) => data as FullResults)
      : Promise.resolve(null),
  ]);
  return { preview, comparison, full };
}

export default function HubResult() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const surveyId = Number(id);
  // undefined = 불러오는 중, string = 오류 문구
  const [loaded, setLoaded] = useState<Loaded | string | undefined>(undefined);
  const [viewing, setViewing] = useState(false);

  const load = useCallback(() => {
    fetchAll(surveyId).then(setLoaded);
  }, [surveyId]);

  useFocusEffect(load);

  if (loaded === undefined || typeof loaded === "string") {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "설문 결과" }} />
        {loaded === undefined ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.muted}>{loaded}</Text>
        )}
      </View>
    );
  }

  const { preview: p, comparison, full } = loaded;

  // 전체 열람: 서버가 무료 여부·차감·등록자 분배를 한 번에 처리
  const view = async () => {
    setViewing(true);
    const { error } = await supabase.rpc("view_survey", { p_survey_id: surveyId });
    setViewing(false);
    if (error) {
      showNotice("열람하지 못했어요", errorMessage(error));
      return;
    }
    load();
  };

  const confirmView = () =>
    p.free_reason
      ? view()
      : showConfirm({
          title: `${formatPoints(p.price)}로 전체 결과를 볼까요?`,
          message: "한 번 열람하면 계속 볼 수 있어요.",
          okLabel: "열람",
          cancelLabel: "취소",
          onOk: view,
        });

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "설문 결과" }} />

      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
        {/* ── 누구나 (무료): 설문 정보 ── */}
        <View style={styles.header}>
          <View style={styles.badges}>
            <Badge label={p.category_name} />
            <Badge label={formatHost(p)} tone="muted" />
            {p.trusted && <Badge label="✓ 신뢰도 높음" tone="accent" />}
          </View>
          <Text style={styles.title}>{p.title}</Text>
          {p.description ? <Text style={styles.body}>{p.description}</Text> : null}
          <Text style={styles.meta}>
            응답 {p.response_count}명 · {formatDate(p.started_at)} ~ {formatDate(p.ended_at)}
          </Text>
          {p.low_count && <Text style={styles.warning}>응답 수가 적어 참고용으로만 봐 주세요.</Text>}
        </View>

        {/* 열람 전: 응답자 구성 · 문항 목록 · 내 답 비교 (열람 후에는 아래 결과 탭으로) */}
        {!full && <CompositionChart groups={p.composition} compact />}

        {!full && (
          <Card>
            <Text style={styles.boxTitle}>문항 {p.questions.length}개</Text>
            {p.questions.map((q, i) => (
              <View key={i} style={styles.questionRow}>
                <Text style={styles.questionNo}>Q{i + 1}</Text>
                <Text style={styles.questionText}>
                  {q.text} <Text style={styles.label}>· {QUESTION_TYPE_LABELS[q.type]}</Text>
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* ── 응답자 (무료): 내 답 비교 ── */}
        {comparison && (
          <Card>
            <Text style={styles.boxTitle}>내 답 비교</Text>
            {comparison.map((c, i) => (
              <View key={i} style={[styles.compareRow, i > 0 && styles.divider]}>
                <Text style={styles.body}>{c.text}</Text>
                {c.mine.map((m, j) => (
                  <Text key={j} style={styles.compare}>
                    나: {c.type === "scale" ? `${m}점 (${SCALE_LABELS[Number(m) - 1]})` : m} · 나와 같은 답 {c.same_pct[j]}%
                  </Text>
                ))}
              </View>
            ))}
          </Card>
        )}

        {/* ── 열람 (전체 결과) ── */}
        {full && <ResultsView surveyId={surveyId} full={full} title={p.title} host={formatHost(p)} />}

        {!p.mine && <ReportLink surveyId={surveyId} />}
      </ScrollView>

      {/* ── 열람 버튼 (화면 아래 고정) ── */}
      {!full && (
        <BottomBar>
          <View style={styles.viewBox}>
            <Text style={styles.hint}>
              {p.free_reason ? FREE_REASON_LABELS[p.free_reason] : "핵심 인사이트 · 문항별 그래프 · 계열별 나눠 보기"}
            </Text>
            <PrimaryButton
              title={p.free_reason ? "무료로 전체 결과 보기" : `${formatPoints(p.price)}로 전체 결과 보기`}
              onPress={confirmView}
              loading={viewing}
            />
          </View>
        </BottomBar>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: "800",
    color: colors.text,
    lineHeight: 30,
  },
  body: {
    fontSize: fontSize.body,
    color: colors.text,
    lineHeight: 23,
  },
  meta: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  label: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  warning: {
    fontSize: fontSize.small,
    color: colors.danger,
  },
  hint: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    textAlign: "center",
  },
  muted: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: "center",
  },
  boxTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  questionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  questionNo: {
    width: 28,
    fontSize: fontSize.small,
    fontWeight: "800",
    color: colors.primary,
  },
  questionText: {
    flex: 1,
    fontSize: fontSize.small,
    color: colors.text,
    lineHeight: 20,
  },
  compareRow: {
    gap: 2,
    paddingVertical: spacing.sm,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  compare: {
    fontSize: fontSize.small,
    color: colors.primary,
    fontWeight: "600",
  },
  viewBox: {
    flex: 1,
    gap: spacing.xs,
  },
});
