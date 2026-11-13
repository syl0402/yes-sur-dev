// ys-112 설문 응답 · F-301~302 (2026-10-31 디자인 · 2026-11-10 선택 주관식·기타·해당 없음·섞기
// · 2026-11-12 설문 흐름 시안 respond/Answer: X · 제목 · +nP 칩 / 칸 진행바 / 문항이 오른쪽에서 들어옴 / 이전은 2번부터)
import { Stack, router, useLocalSearchParams, usePreventRemove } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BottomBar from "@/components/ui/BottomBar";
import Button from "@/components/ui/Button";
import OptionRow from "@/components/ui/OptionRow";
import { Text, TextInput } from "@/components/ui/Text";
import HeaderBack from "@/components/ui/HeaderBack";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { formatPoints } from "@/lib/format";
import { showNotice } from "@/lib/notice";
import { fetchRules } from "@/lib/rules";
import { supabase } from "@/lib/supabase";
import { OTHER_TEXT_MAX, type OptionKind, type QuestionType, SCALE_LABELS } from "@/lib/surveyDraft";

type Option = { id: number; sort_order: number; text: string; kind: OptionKind };
// required: false면 비워도 되는 문항 (2026-11-10 주관식 → 2026-11-14 모든 종류) · long: 긴 주관식(여러 줄) / 짧은(한 줄)
type Question = { id: number; type: QuestionType; text: string; required: boolean; long: boolean; options: Option[] };
// 문항 하나의 답: 고르기는 optionIds(+ 기타를 골랐으면 otherText), 척도는 scale(1~5), 주관식은 text
type Answer = { optionIds?: number[]; otherText?: string; scale?: number; text?: string };
// 화면 위에 보여 줄 설문 정보 (제목·예상 시간·보상)
type SurveyInfo = { title: string; est_minutes: number; reward_points: number };

const SCALE_VALUES = [1, 2, 3, 4, 5];

// 문항 종류별 안내 한 줄
const TYPE_HINT: Record<QuestionType, string> = {
  single: "가장 가까운 답 하나를 골라 주세요.",
  multi: "여러 개 고를 수 있어요.",
  scale: "가장 가까운 정도를 골라 주세요.",
  text: "자유롭게 적어 주세요.",
};

// 이 오류가 나면 더 응답할 수 없으니 안내 후 화면을 닫는다 (그 외 오류는 다시 제출해 볼 수 있게 남긴다)
const CANNOT_CONTINUE = ["already_responded", "survey_closed", "survey_full", "not_target", "survey_not_found"];

// 문항과 보기를 순서대로 (응답 대상이 아니면 DB 권한 때문에 안 읽힌다 → 빈 목록)
// 섞기를 켠 문항은 여기서 한 번만 섞는다 (이전·다음을 오가도 순서가 그대로). 해당 없음·기타는 맨 아래
async function fetchQuestions(surveyId: number): Promise<Question[]> {
  const { data } = await supabase
    .from("questions")
    .select("id, sort_order, type, text, is_required, shuffle_options, long_text, question_options(id, sort_order, text, kind)")
    .eq("survey_id", surveyId)
    .order("sort_order");

  return (data ?? []).map((q) => {
    const options = [...((q.question_options ?? []) as Option[])].sort((a, b) => a.sort_order - b.sort_order);
    const normal = options.filter((o) => o.kind === "normal");
    const special = options.filter((o) => o.kind !== "normal");
    return {
      id: q.id,
      type: q.type as QuestionType,
      text: q.text,
      required: q.is_required !== false,
      long: q.long_text !== false,
      options: [...(q.shuffle_options ? shuffled(normal) : normal), ...special],
    };
  });
}

// 무작위 순서 (원본은 그대로)
function shuffled<T>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// 고른 보기 중에 기타가 있는지
function pickedOther(q: Question, a: Answer | undefined): boolean {
  return q.options.some((o) => o.kind === "other" && (a?.optionIds ?? []).includes(o.id));
}

async function fetchSurveyInfo(surveyId: number): Promise<SurveyInfo | null> {
  const { data } = await supabase
    .from("surveys")
    .select("title, est_minutes, reward_points")
    .eq("id", surveyId)
    .maybeSingle();
  return data;
}

// 이 문항에 답을 다 했는지 ([다음] 버튼 활성 조건)
// 필수가 아닌 문항은 비워도 된다 (고른 게 없거나 글이 비었으면 통과). 기타를 골랐으면 글을 적어야 한다
function isEmptyAnswer(q: Question, a: Answer | undefined): boolean {
  if (!a) return true;
  if (q.type === "scale") return a.scale === undefined;
  if (q.type === "text") return (a.text ?? "").trim() === "";
  return (a.optionIds?.length ?? 0) === 0;
}

function isAnswered(q: Question, a: Answer | undefined): boolean {
  if (!q.required && isEmptyAnswer(q, a)) return true;
  if (!a) return false;
  if (pickedOther(q, a) && (a.otherText ?? "").trim().length < 1) return false;
  if (q.type === "single") return a.optionIds?.length === 1;
  if (q.type === "multi") return (a.optionIds?.length ?? 0) >= 1;
  if (q.type === "scale") return a.scale !== undefined;
  return (a.text ?? "").trim().length >= 1;
}

// submit_response에 보낼 형식 (docs/DB.md "submit_response 답 형식"). 비운 선택 문항: 주관식 text_value "" · 고르기 option_ids [] · 척도 scale_value 없음
function toRpcAnswer(q: Question, a: Answer | undefined) {
  if (q.type === "scale") return a?.scale === undefined ? { question_id: q.id } : { question_id: q.id, scale_value: a.scale };
  if (q.type !== "text" && isEmptyAnswer(q, a)) return { question_id: q.id, option_ids: [] };
  if (q.type === "text") return { question_id: q.id, text_value: (a?.text ?? "").trim() };
  return pickedOther(q, a)
    ? { question_id: q.id, option_ids: a?.optionIds, other_text: (a?.otherText ?? "").trim() }
    : { question_id: q.id, option_ids: a?.optionIds };
}

export default function SurveyRespond() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const surveyId = Number(id);
  const insets = useSafeAreaInsets();

  // undefined = 불러오는 중
  const [questions, setQuestions] = useState<Question[] | undefined>(undefined);
  const [textMax, setTextMax] = useState(0);
  const [info, setInfo] = useState<SurveyInfo | null>(null);
  const [index, setIndex] = useState(0);
  // 문항 id → 답
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [sending, setSending] = useState(false);
  // 응답 화면을 연 시각 → 제출까지 걸린 시간(초)을 서버에 함께 저장 (너무 빠른 응답 걸러 내기)
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  useEffect(() => {
    Promise.all([fetchQuestions(surveyId), fetchRules(["answer_text_max"]), fetchSurveyInfo(surveyId)]).then(
      ([qs, rules, si]) => {
        setTextMax(rules.answer_text_max);
        setInfo(si);
        setQuestions(qs);
      },
    );
  }, [surveyId]);

  // 나가기(상단 버튼·안드로이드 뒤로·밀어서 뒤로) 전에 확인. 임시저장이 없어서 답이 사라진다
  const allowLeave = usePreventRemove(true, ({ repeat }) => {
    showConfirm({
      title: "설문을 그만할까요?",
      message: info
        ? `지금 나가면 답한 내용이 저장되지 않고\n${formatPoints(info.reward_points)}도 받을 수 없어요.`
        : "지금 나가면 답한 내용이 저장되지 않아요.",
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

  // 기타에 적은 글은 보기를 바꿔도 남겨 둔다 (다시 기타를 고르면 그대로)
  const toggleOption = (optionId: number) => {
    if (question.type === "single") {
      // 필수가 아닌 문항은 고른 보기를 다시 누르면 풀린다 (건너뛰기)
      const again = !question.required && answer?.optionIds?.[0] === optionId;
      setAnswer({ ...answer, optionIds: again ? [] : [optionId] });
      return;
    }
    // 여러 개 고르기: 해당 없음은 혼자만 (고르면 다른 보기가 풀리고, 다른 보기를 고르면 해당 없음이 풀린다)
    const noneIds = question.options.filter((o) => o.kind === "none").map((o) => o.id);
    const current = answer?.optionIds ?? [];
    const next = current.includes(optionId)
      ? current.filter((o) => o !== optionId)
      : noneIds.includes(optionId)
        ? [optionId]
        : [...current.filter((o) => !noneIds.includes(o)), optionId];
    setAnswer({ ...answer, optionIds: next });
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
      {/* 위쪽 줄은 직접 그린다: 기본 헤더는 아이폰(iOS 26)에서 버튼마다 유리 거품이 씌워져
          +nP 알약이 두 겹으로 보였다 (2026-11-12). X · 제목 · +nP 한 줄 (시안 respond/Answer) */}
      <Stack.Screen options={{ title: info?.title ?? "설문 응답", headerShown: false }} />
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <View style={styles.topRow}>
          <View style={styles.closeButton}>
            <HeaderBack icon="close" label="설문 나가기" onPress={() => router.back()} />
          </View>
          <Text style={styles.topTitle} numberOfLines={1}>
            {info?.title ?? ""}
          </Text>
          {info && (
            <View style={styles.pointChip}>
              <Text style={styles.pointChipText}>+{formatPoints(info.reward_points)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* 키보드 밑으로 입력칸이 숨지 않게 자동으로 띄운다 */}
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.container}
      >
        {/* 진행: 문항 수만큼 칸 (답한 칸 파랑 · 지금 칸 연파랑) + n / 전체 */}
        <View style={styles.progressRow}>
          <View style={styles.segments}>
            {questions.map((q, i) => (
              <View
                key={q.id}
                style={[
                  styles.segment,
                  i === index ? styles.segmentNow : isAnswered(q, answers[q.id]) && answers[q.id] ? styles.segmentDone : null,
                ]}
              />
            ))}
          </View>
          <Text style={styles.progressCount}>
            <Text style={styles.progressNow}>{index + 1}</Text> / {questions.length}
          </Text>
        </View>

        {/* 문항이 바뀔 때마다 오른쪽에서 살짝 밀려 들어온다 (동작 줄이기 설정이면 바로) */}
        <Animated.View key={question.id} entering={FadeInRight.duration(300)} style={styles.questionArea}>
          <Text style={styles.qNumber}>
            Q{index + 1}
            {question.required ? "" : " · 선택"}
          </Text>
          <Text style={styles.question}>{question.text}</Text>
          <Text style={styles.hint}>
            {question.required ? TYPE_HINT[question.type] : "선택 문항이에요. 비워 두고 넘어가도 돼요."}
          </Text>

          {(question.type === "single" || question.type === "multi") && (
            <View style={styles.options}>
              {question.options.map((o) => (
                <OptionRow
                  key={o.id}
                  label={o.text}
                  selected={answer?.optionIds?.includes(o.id) ?? false}
                  multiple={question.type === "multi"}
                  onPress={() => toggleOption(o.id)}
                />
              ))}
              {/* 기타를 고르면 바로 아래 입력칸 (적어야 다음으로) */}
              {pickedOther(question, answer) && (
                <TextInput
                  style={styles.otherInput}
                  value={answer?.otherText ?? ""}
                  onChangeText={(otherText) => setAnswer({ ...answer, otherText })}
                  placeholder="기타 답을 적어 주세요"
                  maxLength={OTHER_TEXT_MAX}
                  autoFocus
                />
              )}
            </View>
          )}

          {question.type === "scale" && (
            <View style={styles.scaleBox}>
              <View style={styles.scaleRow}>
                {SCALE_VALUES.map((v, i) => {
                  const on = answer?.scale === v;
                  return (
                    <Pressable
                      key={v}
                      style={({ pressed }) => [styles.scaleButton, on && styles.scaleButtonOn, pressed && styles.pressed]}
                      onPress={() => setAnswer(!question.required && on ? {} : { scale: v })}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`${v}점, ${SCALE_LABELS[i]}`}
                    >
                      <Text style={[styles.scaleText, on && styles.scaleTextOn]}>{v}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {/* 아래 이름표: 양 끝 + 가운데 */}
              <View style={styles.scaleLabels}>
                <Text style={styles.scaleLabel}>{SCALE_LABELS[0]}</Text>
                <Text style={styles.scaleLabel}>보통</Text>
                <Text style={styles.scaleLabel}>{SCALE_LABELS[SCALE_LABELS.length - 1]}</Text>
              </View>
            </View>
          )}

          {question.type === "text" && (
            <View style={styles.textBox}>
              {/* 짧은 주관식은 한 줄 입력, 긴 주관식은 큰 상자 (2026-11-14) */}
              <TextInput
                style={[styles.textInput, !question.long && styles.textInputShort]}
                value={answer?.text ?? ""}
                onChangeText={(text) => setAnswer({ text })}
                placeholder="답을 입력해 주세요"
                maxLength={textMax}
                multiline={question.long}
                returnKeyType={question.long ? "default" : "done"}
              />
              <Text style={[styles.hint, styles.counter]}>
                {(answer?.text ?? "").length} / {textMax}자
              </Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* 이전은 2번 문항부터. 답해야 다음(자동으로 넘어가지 않음). 마지막은 "제출하고 nP 받기" */}
      <BottomBar>
        {index > 0 && (
          <Button
            title="이전"
            variant="outline"
            onPress={() => setIndex(index - 1)}
            disabled={sending}
            style={styles.prevButton}
          />
        )}
        <Button
          title={isLast ? (info ? `제출하고 ${formatPoints(info.reward_points)} 받기` : "제출하기") : "다음"}
          onPress={isLast ? confirmSubmit : () => setIndex(index + 1)}
          disabled={!isAnswered(question, answer)}
          loading={sending}
          style={styles.nextButton}
        />
      </BottomBar>
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
    paddingTop: spacing.sm,
    paddingHorizontal: 20,
    paddingBottom: spacing.xl,
  },
  topBar: {
    backgroundColor: colors.background,
  },
  topRow: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingLeft: 6,
    paddingRight: spacing.md,
  },
  // X 버튼 터치 영역 44×44
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  pointChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  pointChipText: {
    fontSize: fontSize.small,
    fontWeight: "800",
    color: colors.onAccentSoft,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  segments: {
    flex: 1,
    flexDirection: "row",
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  segmentNow: {
    backgroundColor: colors.primaryMuted,
  },
  segmentDone: {
    backgroundColor: colors.primary,
  },
  progressCount: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.iconStrong,
  },
  progressNow: {
    color: colors.primary,
  },
  questionArea: {
    paddingTop: 36,
  },
  qNumber: {
    fontSize: fontSize.label,
    fontWeight: "800",
    color: colors.primary,
  },
  question: {
    marginTop: spacing.sm,
    fontSize: 23,
    fontWeight: "800",
    lineHeight: 31,
    color: colors.text,
  },
  hint: {
    marginTop: spacing.sm,
    fontSize: fontSize.label,
    color: colors.iconStrong,
  },
  options: {
    marginTop: spacing.lg,
    gap: 10,
  },
  scaleBox: {
    marginTop: 28,
    gap: 10,
  },
  scaleRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  scaleButton: {
    flex: 1,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  scaleButtonOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  scaleText: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.text,
  },
  scaleTextOn: {
    fontWeight: "800",
    color: colors.onPrimary,
  },
  scaleLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  scaleLabel: {
    fontSize: fontSize.small,
    color: colors.iconStrong,
  },
  textBox: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  textInput: {
    minHeight: 140,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    fontSize: fontSize.body,
    color: colors.text,
    textAlignVertical: "top",
  },
  textInputShort: {
    minHeight: 0,
  },
  counter: {
    textAlign: "right",
  },
  otherInput: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.lg,
    fontSize: fontSize.body,
    color: colors.text,
  },
  prevButton: {
    width: 104,
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
