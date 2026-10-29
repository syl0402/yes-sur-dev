// ys-112 설문 응답 · F-301~302
import { Stack, router, useLocalSearchParams, usePreventRemove } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import StepIndicator from "@/components/StepIndicator";
import { colors, fontSize, spacing } from "@/constants/theme";
import { showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

type Option = { id: number; sort_order: number; text: string };
type Question = { id: number; text: string; options: Option[] };

// 이 오류가 나면 더 응답할 수 없으니 안내 후 화면을 닫는다 (그 외 오류는 다시 제출해 볼 수 있게 남긴다)
const CANNOT_CONTINUE = ["already_responded", "survey_closed", "survey_full", "not_target", "survey_not_found"];

// 문항과 보기를 순서대로 (응답 대상이 아니면 DB 권한 때문에 안 읽힌다 → 빈 목록)
async function fetchQuestions(surveyId: number): Promise<Question[]> {
  const { data } = await supabase
    .from("questions")
    .select("id, sort_order, text, question_options(id, sort_order, text)")
    .eq("survey_id", surveyId)
    .order("sort_order");

  return (data ?? []).map((q) => ({
    id: q.id,
    text: q.text,
    options: [...(q.question_options ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export default function SurveyRespond() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const surveyId = Number(id);

  // undefined = 불러오는 중
  const [questions, setQuestions] = useState<Question[] | undefined>(undefined);
  const [index, setIndex] = useState(0);
  // 문항 id → 고른 보기 id
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchQuestions(surveyId).then(setQuestions);
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
  const selected = answers[question.id];
  const isLast = index === questions.length - 1;

  const choose = (optionId: number) => setAnswers((prev) => ({ ...prev, [question.id]: optionId }));

  const submit = async () => {
    setSending(true);
    // 금액은 보내지 않는다. 서버가 설문에 정해진 보상으로 지급한다
    const { data: reward, error } = await supabase.rpc("submit_response", {
      p_survey_id: surveyId,
      p_answers: questions.map((q) => ({ question_id: q.id, option_id: answers[q.id] })),
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

    // 완료 화면으로 교체 (뒤로 가기로 문항 화면에 돌아오지 않게)
    leaveWithoutAsking(() =>
      router.replace({ pathname: "/survey/done", params: { reward: String(reward ?? 0) } }),
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

      {/* 아이폰 반투명 헤더 밑으로 내용이 숨지 않게 헤더 높이만큼 자동으로 띄운다 */}
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
        <StepIndicator current={index + 1} total={questions.length} />
        <Text style={styles.question}>{question.text}</Text>

        <View style={styles.options}>
          {question.options.map((o) => (
            <Pressable
              key={o.id}
              style={[styles.option, selected === o.id && styles.optionSelected]}
              onPress={() => choose(o.id)}
            >
              <Text style={[styles.optionText, selected === o.id && styles.optionTextSelected]}>{o.text}</Text>
            </Pressable>
          ))}
        </View>
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
            disabled={selected === undefined}
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
