// ys-113 응답 완료 · F-304 (간단판: 결과 미리보기는 2단계)
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import { colors, fontSize, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { supabase } from "@/lib/supabase";

export default function SurveyDone() {
  // 받은 포인트는 제출 결과(서버가 정한 금액)를 넘겨받는다
  const { reward } = useLocalSearchParams<{ reward: string }>();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    supabase.rpc("get_my_balance").then(({ data }) => setBalance(typeof data === "number" ? data : 0));
  }, []);

  // 쌓인 설문 화면을 모두 닫고 탭으로
  const goTab = (tab: "/surveys" | "/home") => {
    router.dismissAll();
    router.navigate(tab);
  };

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
