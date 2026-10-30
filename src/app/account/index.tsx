// ys-151 내 정보 · 회원정보 보기·비밀번호 변경·로그아웃·회원 탈퇴 (2026-10-30)
import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, fontSize, spacing } from "@/constants/theme";
import { showConfirm } from "@/lib/confirm";
import { GENDER_OPTIONS } from "@/lib/demographics";
import { supabase } from "@/lib/supabase";

type Account = {
  name: string;
  isOrg: boolean;
  // 학생인데 성별·출생연도가 비어 있음 (기능 추가 전 가입) → 한 번만 입력
  needsDemographics: boolean;
  // 회원정보 (보기만. 고치려면 문의)
  info: { label: string; value: string }[];
};

// 하나짜리 관계(학교·전공 계열)는 배열로 올 때도 있어서 첫 번째만
function first<T>(raw: unknown): T | null {
  return ((Array.isArray(raw) ? raw[0] : raw) as T | null) ?? null;
}

// 내 회원정보 (본인 것만 읽힌다)
async function fetchAccount(): Promise<Account> {
  const [{ data: profile }, { data: org }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "nickname, account_type, gender, birth_year, admission_year, degree_type, universities(name), major_fields(category_name, name)",
      )
      .maybeSingle(),
    supabase.from("organizations").select("name, kind").maybeSingle(),
  ]);

  const school = first<{ name: string }>(profile?.universities)?.name ?? "";
  const major = first<{ category_name: string; name: string }>(profile?.major_fields);
  const isOrg = profile?.account_type === "org";

  const info = isOrg
    ? [
        { label: "단체 종류", value: org?.kind === "campus" ? "교내 단체" : "외부 단체" },
        ...(school ? [{ label: "학교", value: school }] : []),
      ]
    : [
        { label: "학교", value: school },
        { label: "전공 계열", value: major ? `${major.category_name} · ${major.name}` : "-" },
        {
          label: "과정 · 입학",
          value: `${profile?.degree_type === "grad" ? "대학원" : "학부"} · ${profile?.admission_year ?? "-"}년`,
        },
        { label: "성별", value: GENDER_OPTIONS.find((g) => g.value === profile?.gender)?.label ?? "미입력" },
        { label: "출생연도", value: profile?.birth_year ? `${profile.birth_year}년` : "미입력" },
      ];

  return {
    name: org?.name ?? profile?.nickname ?? "",
    isOrg,
    needsDemographics: !isOrg && (profile?.gender == null || profile?.birth_year == null),
    info,
  };
}

export default function AccountHome() {
  const [account, setAccount] = useState<Account | null>(null);

  // 성별·출생연도를 입력하고 돌아오면 바로 반영되게
  useFocusEffect(
    useCallback(() => {
      fetchAccount().then(setAccount);
    }, []),
  );

  const logout = () =>
    showConfirm({
      title: "로그아웃할까요?",
      message: "",
      okLabel: "로그아웃",
      cancelLabel: "취소",
      onOk: async () => {
        await supabase.auth.signOut();
        router.dismissAll();
        router.replace("/");
      },
    });

  if (account === null) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "내 정보" }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "내 정보" }} />

      <Text style={styles.name}>{account.name ? `${account.name}님` : ""}</Text>

      <Text style={styles.sectionTitle}>회원정보</Text>
      <View style={styles.box}>
        {account.info.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue}>{row.value}</Text>
          </View>
        ))}
        {account.needsDemographics && (
          <Pressable onPress={() => router.push("/account/demographics")} hitSlop={8}>
            <Text style={styles.link}>⚠️ 성별·출생연도 입력하기 ›</Text>
          </Pressable>
        )}
        <Text style={styles.hint}>회원정보를 고치려면 문의해 주세요.</Text>
      </View>

      <Text style={styles.sectionTitle}>계정</Text>
      <View style={styles.box}>
        <MenuRow label="비밀번호 변경" onPress={() => router.push("/account/password")} />
      </View>

      <Pressable onPress={logout} style={styles.logout}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </Pressable>

      {/* 회원 탈퇴 (Google Play 계정 삭제 정책: 앱 안에서 할 수 있어야 함) */}
      <Pressable onPress={() => router.push("/account/delete")} hitSlop={8} style={styles.deleteLink}>
        <Text style={styles.deleteText}>회원 탈퇴</Text>
      </Pressable>
    </ScrollView>
  );
}

function MenuRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.menuRow} onPress={onPress}>
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.menuArrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  name: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
  },
  sectionTitle: {
    marginTop: spacing.sm,
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  box: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rowLabel: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  rowValue: {
    fontSize: fontSize.body,
    color: colors.text,
    fontWeight: "600",
  },
  link: {
    marginTop: spacing.sm,
    fontSize: fontSize.body,
    color: colors.primary,
    fontWeight: "600",
  },
  hint: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  menuRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  menuLabel: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  menuArrow: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  logout: {
    marginTop: spacing.lg,
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
  deleteLink: {
    alignSelf: "center",
    paddingVertical: spacing.sm,
  },
  deleteText: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    textDecorationLine: "underline",
  },
});
