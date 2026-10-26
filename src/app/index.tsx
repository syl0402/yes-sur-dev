import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import { colors, fontSize, spacing } from "@/constants/theme";
import { useSession } from "@/hooks/useSession";
import { formatPoints } from "@/lib/format";
import { supabase } from "@/lib/supabase";

type Me = { name: string; balance: number };

// 내 이름(학생 닉네임 / 단체 이름)과 잔액 (본인 것만 읽힌다)
async function fetchMe(): Promise<Me> {
  const [{ data: profile }, { data: org }, { data: balance }] = await Promise.all([
    supabase.from("profiles").select("nickname").maybeSingle(),
    supabase.from("organizations").select("name").maybeSingle(),
    supabase.rpc("get_my_balance"),
  ]);
  return {
    name: org?.name ?? profile?.nickname ?? "",
    balance: typeof balance === "number" ? balance : 0,
  };
}

// TODO(임시): 개발용 첫 화면 · 진짜 홈(ys-100)을 만들면 교체 · docs/PROGRESS.md
export default function Index() {
  const session = useSession();
  const userId = session?.user.id;
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!userId) return;
    fetchMe().then(setMe);
  }, [userId]);

  const logout = async () => {
    await supabase.auth.signOut();
    setMe(null);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "옛썰" }} />

      <View style={styles.center}>
        <Text style={styles.title}>옛썰</Text>
        <Text style={styles.subtitle}>대학생끼리 설문을 주고받는 곳</Text>

        {userId && (
          <View style={styles.meBox}>
            {me === null ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Text style={styles.meName}>{me.name}님</Text>
                <Text style={styles.meBalance}>내 포인트 {formatPoints(me.balance)}</Text>
              </>
            )}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {session === undefined ? null : userId ? (
          <Pressable onPress={logout} style={styles.textButton}>
            <Text style={styles.textButtonLabel}>로그아웃</Text>
          </Pressable>
        ) : (
          <>
            <PrimaryButton title="로그인" onPress={() => router.push("/login")} />
            <Pressable onPress={() => router.push("/signup/type")} style={styles.textButton}>
              <Text style={styles.textButtonLabel}>
                처음이신가요? <Text style={styles.textButtonStrong}>회원가입</Text>
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSize.hero,
    fontWeight: "800",
    color: colors.primary,
  },
  subtitle: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  meBox: {
    marginTop: spacing.lg,
    alignItems: "center",
    gap: 4,
  },
  meName: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
  },
  meBalance: {
    fontSize: fontSize.body,
    color: colors.primary,
  },
  footer: {
    gap: spacing.md,
    alignItems: "stretch",
  },
  textButton: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  textButtonLabel: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  textButtonStrong: {
    color: colors.primary,
    fontWeight: "600",
  },
});
