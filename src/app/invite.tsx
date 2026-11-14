// ys-156 친구 초대 · F-905 (내 초대 코드 복사·공유 + 가입 직후 친구 코드 입력, 기간은 point_rules. 2026-11-10 화면 정리)
// 2026-11-14 마이 탭 시안 ④: 파란 코드 카드 · 초대한 친구 · 받은 포인트 · 연두 "친구한테 코드 받았어요"(남은 일수) · 안내 3줄
import * as Clipboard from "expo-clipboard";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";

import { formStyles } from "@/components/create/formStyles";
import Card from "@/components/ui/Card";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { formatPoints } from "@/lib/format";
import { showNotice } from "@/lib/notice";
import { fetchRules } from "@/lib/rules";
import { supabase } from "@/lib/supabase";

// get_my_invite
type Invite = {
  code: string;
  invited: number;
  can_redeem: boolean;
  deadline: string;
  inviter_reward: number;
  invitee_reward: number;
};

const CODE_LENGTH = 6;

export default function InviteScreen() {
  // undefined = 불러오는 중, string = 오류 문구
  const [invite, setInvite] = useState<Invite | string | undefined>(undefined);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // 입력 기간(일)·한 달 최대 인원 (point_rules)
  const [rules, setRules] = useState<Record<string, number>>({});
  // 초대로 받은 포인트 (내가 초대한 쪽으로 받은 것만)
  const [earned, setEarned] = useState(0);
  // 코드 입력 남은 일수 (마감일까지, 오늘 포함)
  const [daysLeft, setDaysLeft] = useState(0);

  const load = useCallback(() => {
    supabase.rpc("get_my_invite").then(({ data, error: loadError }) => {
      setInvite(loadError ? errorMessage(loadError) : (data as Invite));
      if (data) setDaysLeft(Math.max(0, Math.ceil((new Date((data as Invite).deadline).getTime() - Date.now()) / 86400000)));
    });
    fetchRules(["invite_window_days", "invite_monthly_max"]).then(setRules);
    supabase
      .from("point_ledger")
      .select("amount")
      .eq("status", "confirmed")
      .eq("reason", "invite")
      .eq("ref_id", "inviter")
      .then(({ data }) => setEarned((data ?? []).reduce((sum, r) => sum + r.amount, 0)));
  }, []);

  useFocusEffect(load);

  if (invite === undefined || typeof invite === "string") {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "친구 초대" }} />
        {invite === undefined ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.muted}>{invite}</Text>}
      </View>
    );
  }

  const message =
    `옛썰에서 설문 응답하고 포인트 모아요! 가입한 뒤 마이 탭 > 친구 초대에서 ` +
    `내 코드 ${invite.code}를 입력하면 ${formatPoints(invite.invitee_reward)}를 받아요.`;

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(invite.code);
      showNotice("초대 코드를 복사했어요", invite.code);
    } catch {
      showNotice("복사하지 못했어요", "코드를 직접 알려 주세요.");
    }
  };

  // 웹은 브라우저에 공유 기능이 없거나 막혀 있으면 메시지를 복사해 준다 (2026-11-07 피드백: 웹에서 안 눌림)
  const share = async () => {
    try {
      await Share.share({ message });
    } catch {
      if (Platform.OS !== "web") return;
      try {
        await Clipboard.setStringAsync(message);
        showNotice("초대 메시지를 복사했어요", "카톡 등에 붙여 넣어 보내 주세요.");
      } catch {
        showNotice("공유하지 못했어요", "초대 코드를 복사해서 보내 주세요.");
      }
    }
  };

  const redeem = async () => {
    if (code.trim().length !== CODE_LENGTH || sending) return;
    setSending(true);
    setError("");
    const { data, error: redeemError } = await supabase.rpc("redeem_invite", { p_code: code.trim() });
    setSending(false);
    if (redeemError) {
      setError(errorMessage(redeemError));
      return;
    }
    setCode("");
    showNotice("초대 코드를 입력했어요", `+${formatPoints((data as { reward: number }).reward)}를 받았어요.`);
    load();
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "친구 초대" }} />

      {/* 맨 위: 무엇을 받는지 한눈에 */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>친구 초대하고{"\n"}같이 포인트 받기</Text>
        <Text style={styles.heroSub}>
          친구가 내 코드를 넣으면 나는 <Text style={styles.heroStrong}>{formatPoints(invite.inviter_reward)}</Text>, 친구는{" "}
          <Text style={styles.heroStrong}>{formatPoints(invite.invitee_reward)}</Text>
        </Text>
      </View>

      <View style={styles.block}>
        {/* 내 초대 코드: 파란 카드 + 복사(반투명) · 공유(흰) */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>내 초대 코드</Text>
          <Text style={styles.code} selectable>
            {invite.code}
          </Text>
          <View style={styles.buttons}>
            <Pressable style={({ pressed }) => [styles.button, styles.copyButton, pressed && styles.pressed]} onPress={copy}>
              <Text style={styles.copyText}>코드 복사</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.button, styles.shareButton, pressed && styles.pressed]} onPress={share}>
              <Text style={styles.shareText}>공유하기</Text>
            </Pressable>
          </View>
        </View>

        {/* 초대한 친구 · 받은 포인트 */}
        <Card style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{invite.invited}명</Text>
            <Text style={styles.statLabel}>초대한 친구</Text>
          </View>
          <View style={[styles.stat, styles.statLine]}>
            <Text style={styles.statValue}>{formatPoints(earned)}</Text>
            <Text style={styles.statLabel}>받은 포인트</Text>
          </View>
        </Card>
      </View>

      {/* 친구한테 받은 코드 입력 (가입 후 기간 안에, 한 번만) */}
      {invite.can_redeem && (
        <View style={styles.redeem}>
          <View style={styles.redeemHead}>
            <Text style={styles.redeemTitle}>친구한테 코드 받았어요</Text>
            <Text style={styles.redeemDays}>{daysLeft}일 남음</Text>
          </View>
          <Text style={styles.redeemSub}>가입하고 {rules.invite_window_days ?? ""}일 안에 한 번만 넣을 수 있어요</Text>
          <View style={styles.redeemRow}>
            <TextInput
              style={styles.redeemInput}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="코드 6자리"
              maxLength={CODE_LENGTH}
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel="친구 초대 코드"
            />
            <Pressable
              style={({ pressed }) => [
                styles.redeemButton,
                code.trim().length !== CODE_LENGTH && styles.redeemButtonOff,
                pressed && styles.pressed,
              ]}
              onPress={redeem}
              disabled={code.trim().length !== CODE_LENGTH || sending}
            >
              <Text style={styles.redeemButtonText}>{sending ? "…" : "받기"}</Text>
            </Pressable>
          </View>
          {error !== "" && <Text style={formStyles.error}>{error}</Text>}
        </View>
      )}

      {/* 코드를 넣을 수 없을 때 이유 한 줄 (가입 후 기간 지남 · 이미 넣음) */}
      {!invite.can_redeem && (
        <Text style={styles.redeemOff}>친구 코드는 가입하고 {rules.invite_window_days ?? ""}일 안에 한 번만 넣을 수 있어요.</Text>
      )}

      {/* TODO(임시): 비공개 테스트 안내 · 정식 출시 때 지우기 · 2026-11-14 */}
      <View style={styles.betaBox}>
        <Text style={styles.betaTitle}>지금은 비공개 테스트 기간이에요</Text>
        <Text style={styles.betaText}>
          아직 플레이스토어에 공개되지 않아서, 초대받은 친구도 테스터로 등록돼야 앱을 설치할 수 있어요. 정식 출시 후에는
          누구나 바로 설치할 수 있어요. 그동안 쌓은 초대 코드는 그대로 쓸 수 있어요.
        </Text>
      </View>

      {/* 안내 */}
      <View style={styles.notes}>
        <Text style={styles.note}>· 친구가 가입하고 {rules.invite_window_days ?? ""}일 안에 코드를 넣어야 해요</Text>
        {rules.invite_monthly_max !== undefined && (
          <Text style={styles.note}>· 포인트는 한 달에 {rules.invite_monthly_max}명까지 받을 수 있어요</Text>
        )}
        <Text style={styles.note}>· 내 코드는 내가 넣을 수 없어요</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 20,
    paddingBottom: spacing.xl,
    gap: 22,
  },
  muted: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  hero: {
    gap: spacing.sm,
  },
  heroTitle: {
    fontSize: fontSize.title,
    lineHeight: 30,
    fontWeight: "800",
    color: colors.text,
  },
  heroSub: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.iconStrong,
  },
  heroStrong: {
    fontWeight: "700",
    color: colors.primaryStrong,
  },
  block: {
    gap: 10,
  },
  // 파란 코드 카드
  codeCard: {
    alignItems: "center",
    padding: 20,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
  },
  codeLabel: {
    fontSize: fontSize.small,
    color: colors.primarySoft,
  },
  code: {
    marginTop: 6,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 6,
    color: colors.onPrimary,
  },
  buttons: {
    alignSelf: "stretch",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: 14,
  },
  button: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  copyButton: {
    backgroundColor: colors.onPrimarySoft,
  },
  copyText: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  shareButton: {
    backgroundColor: colors.onPrimary,
  },
  shareText: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.primaryStrong,
  },
  pressed: {
    opacity: 0.7,
  },
  stats: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 0,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statLine: {
    borderLeftWidth: 1,
    borderLeftColor: colors.surfaceMuted,
  },
  statValue: {
    fontSize: fontSize.subtitle,
    fontWeight: "800",
    color: colors.text,
  },
  statLabel: {
    fontSize: fontSize.caption,
    color: colors.iconStrong,
  },
  // 친구한테 받은 코드 입력 (연두 상자)
  redeem: {
    gap: 4,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
  },
  redeemHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  redeemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  redeemDays: {
    fontSize: fontSize.caption,
    fontWeight: "700",
    color: colors.onAccentSoft,
  },
  redeemSub: {
    fontSize: fontSize.small,
    color: colors.onAccentSoft,
  },
  redeemRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  redeemInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.accentLine,
    borderRadius: radius.md,
    backgroundColor: colors.onPrimary,
    fontSize: fontSize.body,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.text,
  },
  redeemButton: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text,
  },
  redeemButtonOff: {
    backgroundColor: colors.disabled,
  },
  redeemButtonText: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  redeemOff: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  betaBox: {
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
  },
  betaTitle: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.warning,
  },
  betaText: {
    fontSize: fontSize.small,
    lineHeight: 19,
    color: colors.warning,
  },
  notes: {
    gap: 4,
  },
  note: {
    fontSize: fontSize.caption,
    lineHeight: 18,
    color: colors.iconStrong,
  },
});
