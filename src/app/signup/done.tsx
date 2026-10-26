// ys-002 가입 완료 · F-105 웰컴 포인트 안내
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import { colors, fontSize, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { supabase } from "@/lib/supabase";

export default function SignupDone() {
  const [balance, setBalance] = useState<number | null>(null);

  // 지급된 포인트는 서버 잔액에서 읽는다 (금액을 코드에 쓰지 않는다)
  useEffect(() => {
    supabase.rpc("get_my_balance").then(({ data }) => {
      setBalance(typeof data === "number" ? data : 0);
    });
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: "가입 완료", headerBackVisible: false, gestureEnabled: false }}
      />

      <View style={styles.center}>
        <Text style={styles.heading}>가입을 환영해요!</Text>
        {balance === null ? (
          <ActivityIndicator color={colors.primary} />
        ) : balance > 0 ? (
          <Text style={styles.message}>
            웰컴 포인트 <Text style={styles.points}>{formatPoints(balance)}</Text>가 지급됐어요.
          </Text>
        ) : (
          <Text style={styles.message}>이제 옛썰을 시작할 수 있어요.</Text>
        )}
      </View>

      <PrimaryButton title="시작하기" onPress={() => router.replace("/")} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: "space-between",
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  heading: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
  },
  message: {
    fontSize: fontSize.body,
    color: colors.text,
    textAlign: "center",
  },
  points: {
    color: colors.primary,
    fontWeight: "700",
  },
});
