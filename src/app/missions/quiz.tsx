// ys-181 웰컴 미션 1일차 OX 퀴즈 · F-210 (2026-11-12)
// 한 문제씩 O / X → 5개를 다 고르면 서버가 채점(정답은 서버에만) → 결과와 설명 → 다 맞히면 미션 화면으로(자동 지급)
import { Stack, router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";

import PrimaryButton from "@/components/PrimaryButton";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

// 문제 순서는 서버 missions.meta.answers(정답 순서)와 같아야 한다. 설명은 채점 뒤에만 보여 준다
const QUESTIONS = [
  { q: "설문은 빨리 끝낼수록 포인트를 더 받아요.", why: "포인트는 설문 길이에 따라 정해져요. 천천히, 솔직하게 답해 주세요." },
  { q: "설문 중간에 \"이 문항은 ②를 고르세요\" 같은 확인 문항이 나올 수 있어요.", why: "끝까지 읽고 있는지 확인하는 문항이에요." },
  { q: "확인 문항을 틀리면 응답이 인정되지 않고 포인트도 받지 못해요.", why: "대충 한 응답은 결과를 틀어지게 해서 모두에게 손해예요." },
  { q: "포인트는 현금이나 기프티콘으로 바꿀 수 있어요.", why: "옛썰 포인트는 앱 안에서만 써요." },
  { q: "모은 포인트로 다른 사람의 설문 결과를 보거나 내 설문을 올릴 수 있어요.", why: "데이터 탭 결과 열람과 설문 등록에 포인트를 써요." },
];

type Result = { passed: boolean; wrong: number[] };

export default function MissionQuiz() {
  const [answers, setAnswers] = useState<(boolean | null)[]>(QUESTIONS.map(() => null));
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [sending, setSending] = useState(false);

  const pick = async (value: boolean) => {
    if (sending) return;
    const next = answers.map((a, i) => (i === index ? value : a));
    setAnswers(next);
    if (index + 1 < QUESTIONS.length) {
      setIndex(index + 1);
      return;
    }
    // 마지막 문제: 채점
    setSending(true);
    const { data, error } = await supabase.rpc("submit_mission_quiz", { p_answers: next });
    setSending(false);
    if (error) {
      showNotice("채점하지 못했어요", errorMessage(error));
      return;
    }
    setResult(data as Result);
  };

  const retry = () => {
    setAnswers(QUESTIONS.map(() => null));
    setIndex(0);
    setResult(null);
  };

  if (result) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        <Stack.Screen options={{ title: "OX 퀴즈" }} />
        <Text style={styles.resultTitle}>{result.passed ? "모두 맞혔어요!" : `${result.wrong.length}문제를 틀렸어요`}</Text>
        <Text style={styles.resultSub}>
          {result.passed ? "미션 화면으로 돌아가면 포인트가 적립돼요." : "설명을 읽고 다시 풀어 보세요. 몇 번이든 괜찮아요."}
        </Text>
        <View style={styles.list}>
          {QUESTIONS.map((item, i) => {
            const wrong = result.wrong.includes(i);
            return (
              <View key={i} style={[styles.item, wrong && styles.itemWrong]}>
                <Text style={[styles.mark, wrong ? styles.markWrong : styles.markRight]}>{wrong ? "틀렸어요" : "맞았어요"}</Text>
                <Text style={styles.itemQ}>{item.q}</Text>
                {/* 틀린 문제는 정답을 바로 알려 주지 않고 설명만 */}
                <Text style={styles.itemWhy}>{item.why}</Text>
              </View>
            );
          })}
        </View>
        {result.passed ? (
          <PrimaryButton title="미션 화면으로" onPress={() => router.back()} />
        ) : (
          <PrimaryButton title="다시 풀기" onPress={retry} />
        )}
      </ScrollView>
    );
  }

  const item = QUESTIONS[index];
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "OX 퀴즈" }} />
      <View style={styles.container}>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            <Text style={styles.progressStrong}>{index + 1}</Text> / {QUESTIONS.length}
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${((index + 1) / QUESTIONS.length) * 100}%` }]} />
          </View>
        </View>

        <Animated.View key={index} entering={FadeInRight.duration(300)} style={styles.card}>
          <Text style={styles.qLabel}>Q{index + 1}.</Text>
          <Text style={styles.question}>{item.q}</Text>
        </Animated.View>

        <View style={styles.choices}>
          {([true, false] as const).map((v) => (
            <Pressable
              key={String(v)}
              onPress={() => pick(v)}
              disabled={sending}
              accessibilityLabel={v ? "O, 맞아요" : "X, 아니에요"}
              style={({ pressed }) => [styles.choice, v ? styles.choiceO : styles.choiceX, pressed && styles.pressed]}
            >
              <Text style={[styles.choiceMark, v ? styles.choiceMarkO : styles.choiceMarkX]}>{v ? "O" : "X"}</Text>
              <Text style={styles.choiceLabel}>{v ? "맞아요" : "아니에요"}</Text>
            </Pressable>
          ))}
        </View>
        {index > 0 && (
          <Pressable onPress={() => setIndex(index - 1)} hitSlop={8} style={styles.back}>
            <Text style={styles.backText}>이전 문제</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    gap: spacing.md,
  },
  progressRow: {
    gap: spacing.sm,
  },
  progressText: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  progressStrong: {
    fontWeight: "700",
    color: colors.primary,
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    overflow: "hidden",
  },
  fill: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  card: {
    marginTop: spacing.sm,
    minHeight: 160,
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryFaint,
  },
  qLabel: {
    fontSize: fontSize.body,
    fontWeight: "800",
    color: colors.primary,
  },
  question: {
    fontSize: fontSize.subtitle + 2,
    lineHeight: 30,
    fontWeight: "700",
    color: colors.text,
  },
  choices: {
    flexDirection: "row",
    gap: spacing.md - spacing.xs,
  },
  choice: {
    flex: 1,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  choiceO: {
    borderColor: colors.primarySoft,
    backgroundColor: colors.surface,
  },
  choiceX: {
    borderColor: colors.hotSoft,
    backgroundColor: colors.surface,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
  choiceMark: {
    fontSize: 56,
    lineHeight: 64,
    fontWeight: "800",
  },
  choiceMarkO: {
    color: colors.primary,
  },
  choiceMarkX: {
    color: colors.hot,
  },
  choiceLabel: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.textMuted,
  },
  back: {
    alignSelf: "center",
    padding: spacing.sm,
  },
  backText: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    textDecorationLine: "underline",
  },
  resultTitle: {
    fontSize: fontSize.title,
    fontWeight: "800",
    color: colors.text,
  },
  resultSub: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  list: {
    gap: spacing.sm,
  },
  item: {
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  itemWrong: {
    borderColor: colors.hot,
    backgroundColor: colors.hotSoft,
  },
  mark: {
    fontSize: fontSize.caption,
    fontWeight: "800",
  },
  markRight: {
    color: colors.primary,
  },
  markWrong: {
    color: colors.hot,
  },
  itemQ: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  itemWhy: {
    fontSize: fontSize.small,
    lineHeight: 19,
    color: colors.textMuted,
  },
});
