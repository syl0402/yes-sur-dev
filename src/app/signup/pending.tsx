// ys-002 가입 완료 · F-105 단체 승인 대기 (대기 / 거절 / 승인)
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";

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
            <Text style={styles.heading}>승인을 기다리고 있어요</Text>
            <Text style={styles.message}>
              <Text style={styles.strong}>{orgName}</Text> 신청을 받았어요.
            </Text>
            <Text style={styles.guide}>
              운영자가 증빙 링크를 확인한 뒤 승인해요. 앱을 다시 열거나 아래 버튼으로 결과를 확인할 수
              있어요.
            </Text>
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
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
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
    fontSize: fontSize.small,
    color: colors.textMuted,
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
