// ys-151 내 정보 · 회원정보 보기·비밀번호 변경·로그아웃·회원 탈퇴 (2026-10-30, 2026-11-10 설정 화면처럼: 선·테두리 줄임)
import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import ListRow from "@/components/ui/ListRow";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import { showConfirm } from "@/lib/confirm";
import { GENDER_OPTIONS } from "@/lib/demographics";
import { openLegal } from "@/lib/legal";
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

      {/* 맨 위 요약: 이니셜 · 이름 · 학교 (마이 탭 프로필과 같은 모양) */}
      <View style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{account.name.slice(0, 1) || "옛"}</Text>
        </View>
        <View style={styles.profileMain}>
          <Text style={styles.name}>{account.name ? `${account.name}님` : ""}</Text>
          {account.info.find((r) => r.label === "학교")?.value ? <Text style={styles.profileSub}>{account.info.find((r) => r.label === "학교")?.value}</Text> : null}
        </View>
      </View>

      {/* 회원정보: 선 없는 연회색 상자 (이름표 회색 · 값 진하게) */}
      <View style={styles.group}>
        <Text style={styles.groupTitle}>회원정보</Text>
        <View style={styles.infoBox}>
          {account.info.map((row) => (
            <View key={row.label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{row.label}</Text>
              <Text style={styles.infoValue}>{row.value}</Text>
            </View>
          ))}
        </View>
        {account.needsDemographics && (
          <Pressable onPress={() => router.push("/account/demographics")} hitSlop={8}>
            <Text style={styles.link}>성별·출생연도 입력하기 ›</Text>
          </Pressable>
        )}
        <Text style={styles.hint}>회원정보를 고치려면 ‘의견 보내기’로 문의해 주세요.</Text>
      </View>

      {/* 메뉴: 상자·선 없이 줄만 */}
      <View style={styles.group}>
        <Text style={styles.groupTitle}>계정</Text>
        {menu([
          !account.isOrg && { label: "닉네임 바꾸기", onPress: () => router.push("/account/nickname") },
          { label: "비밀번호 변경", onPress: () => router.push("/account/password") },
          {
            label: "의견 보내기",
            onPress: () => router.push({ pathname: "/feedback", params: { from: "내 정보" } }),
          },
        ])}
      </View>

      <View style={styles.group}>
        <Text style={styles.groupTitle}>안내 · 약관</Text>
        {menu([
          !account.isOrg && {
            label: "사용 안내 다시 보기",
            onPress: () => router.push({ pathname: "/onboarding", params: { again: "1" } }),
          },
          !account.isOrg && { label: "포인트 안내", onPress: () => router.push("/points") },
          { label: "이용약관", onPress: () => openLegal("terms") },
          { label: "개인정보처리방침", onPress: () => openLegal("privacy") },
        ])}
      </View>

      <View style={styles.group}>
        <ListRow plain title="로그아웃" onPress={logout} />
        {/* 회원 탈퇴 (Google Play 계정 삭제 정책: 앱 안에서 할 수 있어야 함) */}
        <Pressable onPress={() => router.push("/account/delete")} hitSlop={8} style={styles.deleteLink}>
          <Text style={styles.deleteText}>회원 탈퇴</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

type MenuItem = { label: string; onPress: () => void };

// 메뉴 줄들 (조건에 안 맞아 false인 줄은 뺀다)
function menu(items: (MenuItem | false)[]) {
  return items
    .filter((m): m is MenuItem => m !== false)
    .map((m) => <ListRow key={m.label} plain title={m.label} onPress={m.onPress} />);
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
    padding: 20,
    paddingBottom: spacing.xl,
    gap: 28,
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.primary,
  },
  profileMain: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  profileSub: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  // 묶음: 작은 회색 제목 + 내용
  group: {
    gap: spacing.xs,
  },
  groupTitle: {
    marginBottom: spacing.xs,
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.textMuted,
  },
  infoBox: {
    padding: 18,
    gap: 14,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  infoValue: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  link: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.primary,
  },
  hint: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
    fontSize: fontSize.caption,
    color: colors.textSubtle,
  },
  deleteLink: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  deleteText: {
    fontSize: fontSize.caption,
    color: colors.textSubtle,
    textDecorationLine: "underline",
  },
});
