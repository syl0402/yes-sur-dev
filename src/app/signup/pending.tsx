// ys-002 가입 완료 · F-105 단체 승인 대기 (대기 / 거절 / 승인)
// 2026-11-14 온보딩 시안: 학사모 캐릭터 · "승인 신청을 받았어요" · 단체 이름 + 상태 "확인 중" 카드
// (시안의 [둘러보기]는 승인 전 단체가 다른 화면에 들어갈 수 없어 "결과 다시 확인하기"로 둔다. 승인 알림 메일도 아직 없어 문구에서 뺐다)
import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";

const STUDY = require("../../../assets/images/characters/study.png");

type Status = "pending" | "approved" | "rejected";

// 승인 상태와 단체 정보 불러오기 (본인 것만 읽힌다)
function fetchStatus() {
  return Promise.all([
    supabase.from("profiles").select("approval_status").maybeSingle(),
    supabase.from("organizations").select("name, reject_reason").maybeSingle(),
  ]);
}

export default function SignupPending() {
  const [status, setStatus] = useState<Status | null>(null);
  const [orgName, setOrgName] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(true);

  const apply = ([{ data: profile }, { data: org }]: Awaited<ReturnType<typeof fetchStatus>>) => {
    setStatus((profile?.approval_status as Status) ?? null);
    setOrgName(org?.name ?? "");
    setRejectReason(org?.reject_reason ?? "");
    setLoading(false);
  };

  // 화면이 열릴 때 한 번
  useEffect(() => {
    fetchStatus().then(apply);
  }, []);

  // "결과 다시 확인하기" 버튼
  const reload = () => {
    setLoading(true);
    fetchStatus().then(apply);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: "단체 가입", headerBackVisible: false, gestureEnabled: false }}
      />

      <View style={styles.center}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : status === "approved" ? (
          <>
            <Text style={styles.heading}>승인됐어요!</Text>
            <Text style={styles.message}>
              이제 <Text style={styles.strong}>{orgName}</Text> 이름으로 설문을 올릴 수 있어요.
            </Text>
          </>
        ) : status === "rejected" ? (
          <>
            <Text style={styles.heading}>승인되지 않았어요</Text>
            <Text style={styles.message}>{orgName}</Text>
            <View style={styles.reasonBox}>
              <Text style={styles.reasonLabel}>사유</Text>
              <Text style={styles.reason}>{rejectReason || "사유가 아직 적혀 있지 않아요."}</Text>
            </View>
            <Text style={styles.guide}>내용을 고쳐서 다시 신청할 수 있어요.</Text>
          </>
        ) : (
          <>
            {/* 학사모 캐릭터 (연파랑 원) */}
            <View style={styles.circle}>
              <Image source={STUDY} style={styles.mascot} contentFit="contain" accessibilityLabel="옛썰 캐릭터" />
            </View>
            <Text style={styles.heading}>승인 신청을 받았어요</Text>
            <Text style={styles.guide}>
              운영자가 단체 정보를 확인하고 있어요.{"\n"}앱을 다시 열거나 아래 버튼으로 결과를 확인할 수 있어요.
            </Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>단체 이름</Text>
                <Text style={styles.infoValue}>{orgName}</Text>
              </View>
              <View style={[styles.infoRow, styles.infoRowLine]}>
                <Text style={styles.infoLabel}>상태</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>확인 중</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </View>

      <View style={styles.footer}>
        {status === "approved" && (
          <PrimaryButton title="시작하기" onPress={() => router.replace("/")} />
        )}
        {status === "rejected" && (
          <PrimaryButton
            title="다시 신청하기"
            onPress={() =>
              // 처음 가입할 때 약관에 동의했으므로 그대로 이어서 재신청
              router.replace({ pathname: "/signup/org-info", params: { agreed: "1", resubmit: "1" } })
            }
          />
        )}
        {status === "pending" && (
          <PrimaryButton title="결과 다시 확인하기" onPress={reload} loading={loading} />
        )}
        <Pressable onPress={logout} style={styles.logout}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </Pressable>
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
    gap: spacing.md,
  },
  heading: {
    fontSize: 25,
    lineHeight: 34,
    fontWeight: "800",
    color: colors.text,
  },
  circle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryFaint,
  },
  mascot: {
    width: 150,
    height: 150,
  },
  infoCard: {
    alignSelf: "stretch",
    marginTop: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  infoRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  infoRowLine: {
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  infoLabel: {
    fontSize: 15,
    color: colors.iconStrong,
  },
  infoValue: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.warningSoft,
  },
  statusText: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.warning,
  },
  message: {
    fontSize: fontSize.body,
    color: colors.text,
    textAlign: "center",
  },
  strong: {
    fontWeight: "700",
    color: colors.primary,
  },
  guide: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.iconStrong,
    textAlign: "center",
  },
  reasonBox: {
    alignSelf: "stretch",
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: 4,
  },
  reasonLabel: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  reason: {
    fontSize: fontSize.body,
    color: colors.danger,
  },
  footer: {
    gap: spacing.md,
  },
  logout: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  logoutText: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
});
