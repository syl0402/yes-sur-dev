// ys-150 마일리지 지갑 · F-701
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fontSize, spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";

// 내 이름: 학생은 닉네임, 단체는 단체 이름 (본인 것만 읽힌다)
async function fetchMyName(): Promise<string> {
  const [{ data: profile }, { data: org }] = await Promise.all([
    supabase.from("profiles").select("nickname").maybeSingle(),
    supabase.from("organizations").select("name").maybeSingle(),
  ]);
  return org?.name ?? profile?.nickname ?? "";
}

// TODO(임시): 이름·로그아웃만 · 설문 1단계 ⑤에서 지갑(잔액·적립 내역) 추가 · docs/PROGRESS.md
export default function My() {
  const [name, setName] = useState("");

  useFocusEffect(
    useCallback(() => {
      fetchMyName().then(setName);
    }, []),
  );

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{name ? `${name}님` : ""}</Text>

      <Pressable onPress={logout} style={styles.logout}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  name: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
  },
  logout: {
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    alignItems: "center",
  },
  logoutText: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
});
