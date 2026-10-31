// ys-113 응답 완료 · F-304 (2026-10-31 디자인: 가운데 적립 표시 + 아래 버튼)
// TODO(임시): 가운데 그림은 이모지 · 디자인팀 마스코트(옛썰이 "마일리지 적립!"·"궁금해요!") PNG를 받으면 교체 · docs/PROGRESS.md
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import BottomBar from "@/components/ui/BottomBar";
import Button from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { supabase } from "@/lib/supabase";

export default function SurveyDone() {
  // 받은 포인트·확인 문항 통과 여부는 제출 결과(서버가 정한 값)를 넘겨받는다
  // reason: attention(확인 문항 오답) / too_fast(너무 빨리 응답)
  const { id, reward, passed, reason } = useLocalSearchParams<{ id: string; reward: string; passed: string; reason?: string }>();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    supabase.rpc("get_my_balance").then(({ data }) => setBalance(typeof data === "number" ? data : 0));
  }, []);

  // 쌓인 설문 화면을 모두 닫고 탭으로
  const goTab = (tab: "/surveys" | "/home") => {
    router.dismissAll();
    router.navigate(tab);
  };

  const failed = passed === "0";

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "응답 완료", headerBackVisible: false, gestureEnabled: false }} />

      {failed ? (
        // 확인 문항을 틀렸거나 너무 빨리 응답한 경우: 포인트 없음, 다시 응답 가능 (2026-10-30·31 결정)
        <View style={styles.body}>
          <View style={[styles.circle, styles.circleFail]}>
            <Text style={styles.emoji}>🤔</Text>
          </View>
          <Text style={styles.title}>포인트가 지급되지 않았어요</Text>
          <Text style={styles.message}>
            {reason === "too_fast"
              ? "문항을 읽기 어려울 만큼 너무 빨리 응답했어요.\n천천히 읽고 답해 주세요."
              : "성실한 응답 확인 문항의 답이 달랐어요."}
          </Text>
          <Text style={styles.message}>다시 응답하면 포인트를 받을 수 있어요.</Text>
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.circle}>
            <Text style={styles.emoji}>🎉</Text>
          </View>
          <View style={styles.rewardPill}>
            <Text style={styles.rewardText}>+{formatPoints(Number(reward ?? 0))} 적립!</Text>
          </View>
          <Text style={styles.title}>응답해 주셔서 고마워요</Text>
          <Text style={styles.message}>당신의 한 번의 답변이 큰 변화를 만들 수 있어요.</Text>
          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>내 포인트</Text>
            <Text style={styles.balanceValue}>{balance === null ? "…" : formatPoints(balance)}</Text>
          </View>
        </View>
      )}

      <BottomBar>
        {failed ? (
          <>
            <Button title="다른 설문" variant="outline" onPress={() => goTab("/surveys")} style={styles.side} />
            <Button
              title="다시 응답하기"
              onPress={() => router.replace({ pathname: "/survey/respond", params: { id } })}
              style={styles.main}
            />
          </>
        ) : (
          <>
            <Button title="홈으로" variant="outline" onPress={() => goTab("/home")} style={styles.side} />
            <Button title="다른 설문 보기" onPress={() => goTab("/surveys")} style={styles.main} />
          </>
        )}
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.md,
  },
  circleFail: {
    backgroundColor: colors.surfaceMuted,
  },
  emoji: {
    fontSize: 56,
  },
  rewardPill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  rewardText: {
    fontSize: fontSize.title,
    fontWeight: "800",
    color: colors.onAccent,
  },
  title: {
    marginTop: spacing.sm,
    fontSize: fontSize.title,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  message: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 24,
  },
  balanceBox: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  balanceLabel: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  balanceValue: {
    fontSize: fontSize.subtitle,
    fontWeight: "800",
    color: colors.primary,
  },
  side: {
    flex: 1,
  },
  main: {
    flex: 2,
  },
});
