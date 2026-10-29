// ys-121 내 설문 결과 · F-406
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, fontSize, spacing } from "@/constants/theme";
import Chips from "@/components/create/Chips";
import { showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { formatTimeLeft } from "@/lib/format";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";
import { type QuestionType, type ResultVisibility, SCALE_LABELS, VISIBILITY_LABELS } from "@/lib/surveyDraft";

// get_survey_results가 돌려주는 모양 (docs/DB.md)
type ResultQuestion = {
  id: number;
  type: QuestionType;
  text: string;
  answered: number;
  options: { id: number; text: string; count: number }[];
  scale: { avg: number | null; counts: number[] } | null;
  texts: string[];
};

type Results = {
  title: string;
  responseCount: number;
  target: number;
  closesAt: string | null;
  closed: boolean;
  visibility: ResultVisibility;
  total: number;
  excluded: number;
  questions: ResultQuestion[];
};

// 결과 + 설문 기본 정보. 결과는 작성자 본인만 받는다 (아니면 오류)
async function fetchResults(id: number): Promise<Results | string> {
  const [{ data: survey }, { data, error }] = await Promise.all([
    supabase
      .from("surveys")
      .select("title, response_count, target_responses, status, closes_at, result_visibility")
      .eq("id", id)
      .maybeSingle(),
    supabase.rpc("get_survey_results", { p_survey_id: id }),
  ]);
  if (error || !survey) return errorMessage(error);

  const result = data as { total: number; excluded: number; questions: ResultQuestion[] };
  return {
    title: survey.title,
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

// 0~1 비율 → 막대 너비 (% 문자열)
function percent(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
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
        {results.excluded > 0 && (
          <Text style={styles.hint}>
            확인 문항을 틀린 응답 {results.excluded}건은 결과에서 뺐어요.
          </Text>
        )}
        {!results.closed && (
          <Pressable style={styles.closeButton} onPress={closeNow} disabled={closing}>
            <Text style={styles.closeText}>{closing ? "마감하는 중…" : "응답 마감하기"}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryMain}>결과 공개</Text>
        <Chips
          options={(["public", "campus", "private"] as const).map((v) => ({ value: v, label: VISIBILITY_LABELS[v] }))}
          selected={results.visibility}
          onSelect={changeVisibility}
        />
        <Text style={styles.hint}>
          {results.visibility === "private"
            ? "결과는 나만 봐요. 이미 열람한 사람은 계속 볼 수 있어요."
            : "마감 후 응답이 5개 이상이면 데이터 허브에 공개돼요. 주관식 답은 공개되지 않아요."}
        </Text>
      </View>

      {results.total === 0 ? (
        <Text style={styles.muted}>아직 결과에 반영된 응답이 없어요.</Text>
      ) : (
        results.questions.map((q, index) => (
          <View key={q.id} style={styles.card}>
            <Text style={styles.questionText}>
              {index + 1}. {q.text}
            </Text>
            <Text style={styles.hint}>응답 {q.answered}개</Text>

            {(q.type === "single" || q.type === "multi") &&
              q.options.map((o) => (
                <Bar key={o.id} label={o.text} count={o.count} pct={percent(o.count, q.answered)} />
              ))}

            {q.type === "scale" && q.scale && (
              <>
                <Text style={styles.average}>평균 {q.scale.avg ?? "-"}점</Text>
                {q.scale.counts.map((count, i) => (
                  <Bar
                    key={i}
                    label={`${i + 1} ${SCALE_LABELS[i]}`}
                    count={count}
                    pct={percent(count, q.answered)}
                  />
                ))}
              </>
            )}

            {q.type === "text" &&
              q.texts.map((t, i) => (
                <Text key={i} style={styles.textAnswer}>
                  {t}
                </Text>
              ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

// 가로 막대 한 줄: 보기 이름 · 막대 · 명(%)
function Bar({ label, count, pct }: { label: string; count: number; pct: number }) {
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
    borderRadius: 12,
    gap: spacing.sm,
  },
  summaryMain: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  closeButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    alignItems: "center",
  },
  closeText: {
    fontSize: fontSize.body,
    color: colors.danger,
    fontWeight: "600",
  },
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    gap: spacing.sm,
  },
  questionText: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
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
    borderRadius: 5,
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
