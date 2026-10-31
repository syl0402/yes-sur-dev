// ys-112 설문 응답 · F-301~302
import { Stack, router, useLocalSearchParams, usePreventRemove } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import StepIndicator from "@/components/StepIndicator";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import { showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { showNotice } from "@/lib/notice";
import { fetchRules } from "@/lib/rules";
import { supabase } from "@/lib/supabase";
import { type QuestionType, SCALE_LABELS } from "@/lib/surveyDraft";

type Option = { id: number; sort_order: number; text: string };
type Question = { id: number; type: QuestionType; text: string; options: Option[] };
// 문항 하나의 답: 고르기는 optionIds, 척도는 scale(1~5), 주관식은 text
type Answer = { optionIds?: number[]; scale?: number; text?: string };

const SCALE_VALUES = [1, 2, 3, 4, 5];

// 이 오류가 나면 더 응답할 수 없으니 안내 후 화면을 닫는다 (그 외 오류는 다시 제출해 볼 수 있게 남긴다)
const CANNOT_CONTINUE = ["already_responded", "survey_closed", "survey_full", "not_target", "survey_not_found"];

// 문항과 보기를 순서대로 (응답 대상이 아니면 DB 권한 때문에 안 읽힌다 → 빈 목록)
async function fetchQuestions(surveyId: number): Promise<Question[]> {
  const { data } = await supabase
    .from("questions")
    .select("id, sort_order, type, text, question_options(id, sort_order, text)")
    .eq("survey_id", surveyId)
    .order("sort_order");

  return (data ?? []).map((q) => ({
    id: q.id,
    type: q.type as QuestionType,
    text: q.text,
    options: [...(q.question_options ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

// 이 문항에 답을 다 했는지 ([다음] 버튼 활성 조건)
function isAnswered(q: Question, a: Answer | undefined): boolean {
  if (!a) return false;
  if (q.type === "single") return a.optionIds?.length === 1;
  if (q.type === "multi") return (a.optionIds?.length ?? 0) >= 1;
  if (q.type === "scale") return a.scale !== undefined;
  return (a.text ?? "").trim().length >= 1;
}

// submit_response에 보낼 형식 (docs/DB.md "submit_response 답 형식")
function toRpcAnswer(q: Question, a: Answer) {
  if (q.type === "scale") return { question_id: q.id, scale_value: a.scale };
  if (q.type === "text") return { question_id: q.id, text_value: (a.text ?? "").trim() };
  return { question_id: q.id, option_ids: a.optionIds };
}

export default function SurveyRespond() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const surveyId = Number(id);

  // undefined = 불러오는 중
  const [questions, setQuestions] = useState<Question[] | undefined>(undefined);
  const [textMax, setTextMax] = useState(0);
  const [index, setIndex] = useState(0);
  // 문항 id → 답
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [sending, setSending] = useState(false);
  // 응답 화면을 연 시각 → 제출까지 걸린 시간(초)을 서버에 함께 저장 (나중에 무성의 응답 필터용, 지금은 참고만)
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  useEffect(() => {
    Promise.all([fetchQuestions(surveyId), fetchRules(["answer_text_max"])]).then(([qs, rules]) => {
      setTextMax(rules.answer_text_max);
      setQuestions(qs);
    });
  }, [surveyId]);

  // 나가기(상단 버튼·안드로이드 뒤로·밀어서 뒤로) 전에 확인. 임시저장이 없어서 답이 사라진다
  const allowLeave = usePreventRemove(true, ({ repeat }) => {
    showConfirm({
      title: "응답을 그만둘까요?",
      message: "고른 답은 저장되지 않아요.",
      okLabel: "나가기",
      cancelLabel: "계속하기",
      destructive: true,
      onOk: repeat,
    });
  });

  // 확인 없이 닫기 (제출 완료·더 응답할 수 없는 오류)
  const leaveWithoutAsking = (go: () => void) => {
    allowLeave();
    go();
  };

  if (questions === undefined) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "설문 응답" }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "설문 응답" }} />
        <Text style={styles.muted}>응답할 수 있는 문항이 없어요.</Text>
      </View>
    );
  }

  const question = questions[index];
  const answer = answers[question.id];
  const isLast = index === questions.length - 1;

  const setAnswer = (next: Answer) => setAnswers((prev) => ({ ...prev, [question.id]: next }));

  const toggleOption = (optionId: number) => {
    if (question.type === "single") {
      setAnswer({ optionIds: [optionId] });
      return;
    }
    const current = answer?.optionIds ?? [];
    setAnswer({
      optionIds: current.includes(optionId) ? current.filter((o) => o !== optionId) : [...current, optionId],
    });
  };

  const submit = async () => {
    setSending(true);
    // 금액은 보내지 않는다. 서버가 설문에 정해진 보상으로 지급한다
    const { data, error } = await supabase.rpc("submit_response", {
      p_survey_id: surveyId,
      p_answers: questions.map((q) => toRpcAnswer(q, answers[q.id])),
      p_duration_seconds: Math.round((Date.now() - startedAt.current) / 1000),
    });
    setSending(false);

    if (error) {
      if (CANNOT_CONTINUE.includes(error.message)) {
        showNotice("제출할 수 없어요", errorMessage(error), () => leaveWithoutAsking(() => router.back()));
      } else {
        showNotice("제출하지 못했어요", errorMessage(error));
      }
      return;
    }

    // 결과: { reward, passed, reason } — 확인 문항을 틀리거나 너무 빠르면 passed=false, 포인트 0 (다시 응답 가능)
    const result = data as { reward: number; passed: boolean; reason?: "attention" | "too_fast" };

    // 완료 화면으로 교체 (뒤로 가기로 문항 화면에 돌아오지 않게)
    leaveWithoutAsking(() =>
      router.replace({
        pathname: "/survey/done",
        params: {
          id: String(surveyId),
          reward: String(result.reward),
          passed: result.passed ? "1" : "0",
          reason: result.reason ?? "",
        },
      }),
    );
  };

  const confirmSubmit = () =>
    showConfirm({
      title: "제출할까요?",
      message: "제출하면 답을 바꿀 수 없어요.\n성의 없는 응답은 포인트가 지급되지 않을 수 있어요.",
      okLabel: "제출",
      cancelLabel: "다시 보기",
      onOk: submit,
    });

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: "설문 응답",
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.headerButton}>나가기</Text>
            </Pressable>
          ),
        }}
      />

      {/* 아이폰 반투명 헤더·키보드 밑으로 내용이 숨지 않게 자동으로 띄운다 */}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.container}
      >
        <StepIndicator current={index + 1} total={questions.length} />
        <Text style={styles.question}>{question.text}</Text>
        {question.type === "multi" && <Text style={styles.hint}>여러 개 고를 수 있어요.</Text>}

        {(question.type === "single" || question.type === "multi") && (
          <View style={styles.options}>
            {question.options.map((o) => {
              const on = answer?.optionIds?.includes(o.id) ?? false;
              return (
                <Pressable key={o.id} style={[styles.option, on && styles.optionSelected]} onPress={() => toggleOption(o.id)}>
                  <Text style={[styles.optionText, on && styles.optionTextSelected]}>
                    {question.type === "multi" ? (on ? "☑ " : "☐ ") : ""}
                    {o.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {question.type === "scale" && (
          <View style={styles.scaleBox}>
            <View style={styles.scaleRow}>
              {SCALE_VALUES.map((v) => {
                const on = answer?.scale === v;
                return (
                  <Pressable
                    key={v}
                    style={[styles.scaleButton, on && styles.optionSelected]}
                    onPress={() => setAnswer({ scale: v })}
                  >
                    <Text style={[styles.scaleText, on && styles.optionTextSelected]}>{v}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.scaleLabels}>
              <Text style={styles.hint}>{SCALE_LABELS[0]}</Text>
              <Text style={styles.hint}>{SCALE_LABELS[SCALE_LABELS.length - 1]}</Text>
            </View>
          </View>
        )}

        {question.type === "text" && (
          <View style={styles.textBox}>
            <TextInput
              style={styles.textInput}
              value={answer?.text ?? ""}
              onChangeText={(text) => setAnswer({ text })}
              placeholder="답을 입력해 주세요"
              maxLength={textMax}
              multiline
            />
            <Text style={styles.hint}>
              {(answer?.text ?? "").length} / {textMax}자
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {index > 0 && (
          <Pressable style={styles.prevButton} onPress={() => setIndex(index - 1)} disabled={sending}>
            <Text style={styles.prevText}>이전</Text>
          </Pressable>
        )}
        <View style={styles.nextButton}>
          <PrimaryButton
            title={isLast ? "제출" : "다음"}
            onPress={isLast ? confirmSubmit : () => setIndex(index + 1)}
            disabled={!isAnswered(question, answer)}
            loading={sending}
          />
        </View>
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
    gap: spacing.lg,
  },
  headerButton: {
    fontSize: fontSize.body,
    color: colors.primary,
  },
  question: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
  },
  hint: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  optionText: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  optionTextSelected: {
    color: colors.onPrimary,
    fontWeight: "600",
  },
  scaleBox: {
    gap: spacing.sm,
  },
  scaleRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  scaleButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    alignItems: "center",
  },
  scaleText: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  scaleLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  textBox: {
    gap: spacing.sm,
  },
  textInput: {
    minHeight: 120,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    fontSize: fontSize.body,
    color: colors.text,
    textAlignVertical: "top",
  },
  footer: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  prevButton: {
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  prevText: {
    fontSize: fontSize.body,
    color: colors.text,
    fontWeight: "600",
  },
  nextButton: {
    flex: 1,
  },
  muted: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: "center",
  },
});
