// ys-121 내 설문 결과 · F-406
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, shadow, spacing } from "@/constants/theme";
import Chips from "@/components/create/Chips";
import { showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { formatTimeLeft } from "@/lib/format";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";
import { type QuestionStats } from "@/components/results/QuestionResult";
import ResultsView from "@/components/results/ResultsView";
import { type RawResults, csvFileName, rawCsv, shareCsv } from "@/lib/csv";
import { type FullResults } from "@/lib/hub";
import { type ResultVisibility, VISIBILITY_LABELS } from "@/lib/surveyDraft";
import { formatHost } from "@/lib/surveys";

// get_survey_results가 돌려주는 문항 모양 (등록자라 주관식 답 원문 포함)
type ResultQuestion = QuestionStats;

type Results = {
  title: string;
  host: string;
  // 단체 설문 (주최 표시가 인증 단체) → 열람 수익은 숨김
  isOrg: boolean;
  responseCount: number;
  target: number;
  closesAt: string | null;
  closed: boolean;
  visibility: ResultVisibility;
  total: number;
  excluded: number;
  questions: ResultQuestion[];
  // 나눠 보기·신뢰 정보·열람 수익 (데이터 허브와 같은 집계)
  full: FullResults;
};

// 결과 + 설문 기본 정보. 결과는 작성자 본인만 받는다 (아니면 오류)
async function fetchResults(id: number): Promise<Results | string> {
  const [{ data: survey }, { data, error }, { data: full, error: fullError }] = await Promise.all([
    supabase
      .from("surveys")
      .select("title, host_name, host_verified, response_count, target_responses, status, closes_at, result_visibility")
      .eq("id", id)
      .maybeSingle(),
    supabase.rpc("get_survey_results", { p_survey_id: id }),
    supabase.rpc("get_full_results", { p_survey_id: id }),
  ]);
  if (error || fullError || !survey) return errorMessage(error ?? fullError);

  const result = data as { total: number; excluded: number; questions: ResultQuestion[] };
  return {
    title: survey.title,
    host: formatHost(survey),
    isOrg: survey.host_verified,
    full: full as FullResults,
    responseCount: survey.response_count,
    target: survey.target_responses,
    closesAt: survey.closes_at,
    visibility: survey.result_visibility,
    closed:
      survey.status !== "open" ||
      (survey.closes_at !== null && new Date(survey.closes_at).getTime() <= Date.now()),
    total: result.total,
    excluded: result.excluded,
    questions: result.questions,
  };
}

export default function SurveyResults() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const surveyId = Number(id);
  // undefined = 불러오는 중, string = 오류 문구
  const [results, setResults] = useState<Results | string | undefined>(undefined);
  const [closing, setClosing] = useState(false);

  const load = useCallback(() => {
    fetchResults(surveyId).then(setResults);
  }, [surveyId]);

  // 화면에 올 때마다 새로 불러온다 (응답이 늘었으면 바로 반영)
  useFocusEffect(load);

  if (results === undefined) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "설문 결과" }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (typeof results === "string") {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "설문 결과" }} />
        <Text style={styles.muted}>{results}</Text>
      </View>
    );
  }

  const closeNow = () =>
    showConfirm({
      title: "응답을 마감할까요?",
      message: "마감하면 더 이상 응답을 받지 않아요.\n다시 열 수 없고, 못 받은 인원만큼 등록비를 돌려받아요.",
      okLabel: "마감하기",
      cancelLabel: "취소",
      destructive: true,
      onOk: async () => {
        setClosing(true);
        const { error } = await supabase.rpc("close_survey", { p_survey_id: surveyId });
        setClosing(false);
        if (error) {
          showNotice("마감하지 못했어요", errorMessage(error));
          return;
        }
        load();
      },
    });

  // 원본 CSV (등록자만): 응답 한 사람 = 한 줄. 서버가 개인 정보는 빼고 순서를 섞어서 보낸다
  const downloadRaw = async () => {
    const { data, error } = await supabase.rpc("get_survey_raw", { p_survey_id: surveyId });
    if (error) {
      showNotice("파일을 만들지 못했어요", errorMessage(error));
      return;
    }
    await shareCsv(csvFileName(results.title, "원본"), rawCsv(data as RawResults)).catch(() =>
      showNotice("파일을 만들지 못했어요", "잠시 후 다시 시도해 주세요."),
    );
  };

  // 결과 공개 범위 바꾸기 (작성자만). 좁혀도 이미 열람한 사람은 계속 볼 수 있다
  const changeVisibility = async (next: ResultVisibility) => {
    if (next === results.visibility) return;
    const { error } = await supabase.rpc("set_result_visibility", {
      p_survey_id: surveyId,
      p_visibility: next,
    });
    if (error) {
      showNotice("바꾸지 못했어요", errorMessage(error));
      return;
    }
    load();
  };

  return (
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "설문 결과" }} />

      <Text style={styles.title}>{results.title}</Text>

      <View style={styles.summary}>
        <Text style={styles.summaryMain}>
          응답 {results.responseCount} / {results.target}명
        </Text>
        <Text style={styles.muted}>
          {results.closed ? "마감됨" : formatTimeLeft(results.closesAt) || "진행 중"}
        </Text>
        {results.total > 0 && (
          <Pressable style={styles.rawButton} onPress={downloadRaw}>
            <Text style={styles.rawText}>원본 CSV 받기 (응답 한 명 = 한 줄)</Text>
          </Pressable>
        )}
        {results.total > 0 && <Text style={styles.hint}>원본과 주관식 답은 등록자만 받을 수 있어요.</Text>}
        {!results.closed && (
          <Pressable style={styles.closeButton} onPress={closeNow} disabled={closing}>
            <Text style={styles.closeText}>{closing ? "마감하는 중…" : "응답 마감하기"}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryMain}>결과 공개</Text>
        <Chips
          options={(["public", "campus", "private"] as const).map((v) => ({
            value: v,
            label: VISIBILITY_LABELS[v],
            // TODO(임시): 단체는 테스트 기간 결과 공개 조건 (org_must_publish) · Q14 답이 오면 변경
            disabled: results.isOrg && v === "private",
          }))}
          selected={results.visibility}
          onSelect={changeVisibility}
        />
        <Text style={styles.hint}>
          {results.visibility === "private"
            ? "결과는 나만 봐요. 이미 열람한 사람은 계속 볼 수 있어요."
            : "마감 후 응답이 5개 이상이면 데이터 허브에 공개돼요. 주관식 답은 공개되지 않아요."}
        </Text>
      </View>

      <ResultsView
        full={results.full}
        title={results.title}
        host={results.host}
        questions={results.questions}
        showEarnings={!results.isOrg}
      />

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
  summary: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.sm,
    ...shadow.card,
  },
  summaryMain: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  rawButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    alignItems: "center",
  },
  rawText: {
    fontSize: fontSize.body,
    color: colors.primary,
    fontWeight: "600",
  },
  closeButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    alignItems: "center",
  },
  closeText: {
    fontSize: fontSize.body,
    color: colors.danger,
    fontWeight: "600",
  },
  hint: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  muted: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: "center",
  },
});
