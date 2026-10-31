// ys-113 응답 완료 · F-304 (간단판: 결과 미리보기는 2단계)
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import { colors, fontSize, spacing } from "@/constants/theme";
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

  // 확인 문항을 틀렸거나 너무 빨리 응답한 경우: 포인트 없음, 다시 응답 가능 (2026-10-30·31 결정)
  if (passed === "0") {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: "응답 완료", headerBackVisible: false, gestureEnabled: false }} />

        <View style={styles.body}>
          <Text style={styles.failTitle}>포인트가 지급되지 않았어요</Text>
          <Text style={styles.thanks}>
            {reason === "too_fast"
              ? "문항을 읽기 어려울 만큼 너무 빨리 응답했어요. 천천히 읽고 답해 주세요."
              : "성실한 응답 확인 문항의 답이 달랐어요."}
          </Text>
          <Text style={styles.thanks}>다시 응답하면 포인트를 받을 수 있어요.</Text>
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            title="다시 응답하기"
            onPress={() => router.replace({ pathname: "/survey/respond", params: { id } })}
          />
          <Pressable style={styles.secondaryButton} onPress={() => goTab("/surveys")}>
            <Text style={styles.secondaryText}>다른 설문 보기</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "응답 완료", headerBackVisible: false, gestureEnabled: false }} />

      <View style={styles.body}>
        <Text style={styles.reward}>+{formatPoints(Number(reward ?? 0))} 적립!</Text>
        <Text style={styles.thanks}>응답해 주셔서 고마워요.</Text>
        <Text style={styles.balance}>내 포인트 {balance === null ? "…" : formatPoints(balance)}</Text>
      </View>

      <View style={styles.footer}>
        <PrimaryButton title="다른 설문 보기" onPress={() => goTab("/surveys")} />
        <Pressable style={styles.secondaryButton} onPress={() => goTab("/home")}>
          <Text style={styles.secondaryText}>홈으로</Text>
        </Pressable>
      </View>
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
  reward: {
    fontSize: fontSize.hero,
    fontWeight: "800",
    color: colors.primary,
  },
  failTitle: {
    fontSize: fontSize.title,
    fontWeight: "800",
    color: colors.danger,
    textAlign: "center",
  },
  thanks: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  balance: {
    marginTop: spacing.md,
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  footer: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  secondaryButton: {
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryText: {
    fontSize: fontSize.body,
    color: colors.text,
    fontWeight: "600",
  },
});
