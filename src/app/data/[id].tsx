// ys-131 결과 상세 · F-502~504 (무료 정보 → 내 답 비교 → 열람 → 전체 결과)
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import ReportLink from "@/components/ReportLink";
import ResultsView from "@/components/results/ResultsView";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, shadow, spacing } from "@/constants/theme";
import { showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatPoints } from "@/lib/format";
import {
  type Comparison,
  FREE_REASON_LABELS,
  type FullResults,
  GROUP_DIMS,
  type HubPreview,
  sortGroups,
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
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "설문 결과" }} />

      {/* ── 누구나 (무료): 설문 정보 ── */}
      <Text style={styles.meta}>
        {formatHost(p)} · {p.category_name}
        {p.trusted ? "  ·  신뢰도 높음" : ""}
      </Text>
      <Text style={styles.title}>{p.title}</Text>
      {p.description ? <Text style={styles.body}>{p.description}</Text> : null}
      <Text style={styles.meta}>
        응답 {p.response_count}명 · {formatDate(p.started_at)} ~ {formatDate(p.ended_at)}
      </Text>
      {p.low_count && <Text style={styles.warning}>응답 수가 적어 참고용으로만 봐 주세요.</Text>}

      {/* 응답자 구성 (5명 미만 그룹은 숫자 없이) */}
      <View style={styles.box}>
        <Text style={styles.boxTitle}>응답자 구성</Text>
        {GROUP_DIMS.map((d) => (
          <Text key={d.value} style={styles.body}>
            <Text style={styles.label}>{d.label}  </Text>
            {sortGroups(d.value, p.composition[d.value])
              .map((g) => (g.hidden ? `${g.label} 5명 미만` : `${g.label} ${g.n}`))
              .join(" · ")}
          </Text>
        ))}
      </View>

      {/* 문항 목록 (질문만) — 전체를 볼 수 있으면 아래 결과로 대신 */}
      {!full && (
        <View style={styles.box}>
          <Text style={styles.boxTitle}>문항 {p.questions.length}개</Text>
          {p.questions.map((q, i) => (
            <Text key={i} style={styles.body}>
              {i + 1}. {q.text} <Text style={styles.label}>({QUESTION_TYPE_LABELS[q.type]})</Text>
            </Text>
          ))}
        </View>
      )}

      {/* ── 응답자 (무료): 내 답 비교 ── */}
      {comparison && (
        <View style={styles.box}>
          <Text style={styles.boxTitle}>내 답 비교</Text>
          {comparison.map((c, i) => (
            <View key={i} style={styles.compareRow}>
              <Text style={styles.body}>{c.text}</Text>
              {c.mine.map((m, j) => (
                <Text key={j} style={styles.compare}>
                  나: {c.type === "scale" ? `${m}점 (${SCALE_LABELS[Number(m) - 1]})` : m} · 나와 같은 답 {c.same_pct[j]}%
                </Text>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* ── 열람 버튼 ── */}
      {!full && (
        <View style={styles.viewBox}>
          <PrimaryButton
            title={p.free_reason ? "무료로 전체 결과 보기" : `${formatPoints(p.price)}로 전체 결과 보기`}
            onPress={confirmView}
            loading={viewing}
          />
          <Text style={styles.hint}>
            {p.free_reason ? FREE_REASON_LABELS[p.free_reason] : "전체 그래프·통계·계열별 나눠 보기를 볼 수 있어요."}
          </Text>
        </View>
      )}

      {/* ── 열람 (전체 결과) ── */}
      {full && <ResultsView full={full} title={p.title} host={formatHost(p)} />}

      {!p.mine && <ReportLink surveyId={surveyId} />}
    </ScrollView>
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
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
  },
  body: {
    fontSize: fontSize.body,
    color: colors.text,
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
    fontSize: fontSize.small,
    color: colors.textMuted,
    textAlign: "center",
  },
  muted: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: "center",
  },
  box: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.sm,
    ...shadow.card,
  },
  boxTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  compareRow: {
    gap: 2,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  compare: {
    fontSize: fontSize.small,
    color: colors.primary,
    fontWeight: "600",
  },
  viewBox: {
    gap: spacing.sm,
  },
});
