// ys-156 친구 초대 · F-905 (내 초대 코드 복사·공유 + 가입 직후 친구 코드 입력, 기간은 point_rules)
import * as Clipboard from "expo-clipboard";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";

import { formStyles } from "@/components/create/formStyles";
import PrimaryButton from "@/components/PrimaryButton";
import Card from "@/components/ui/Card";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatPoints } from "@/lib/format";
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

  const load = useCallback(() => {
    supabase.rpc("get_my_invite").then(({ data, error: loadError }) => {
      setInvite(loadError ? errorMessage(loadError) : (data as Invite));
    });
    fetchRules(["invite_window_days", "invite_monthly_max"]).then(setRules);
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

      <Text style={styles.lead}>
        친구가 내 코드를 입력하면 나는 {formatPoints(invite.inviter_reward)}, 친구는 {formatPoints(invite.invitee_reward)}를
        받아요.
      </Text>

      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>내 초대 코드</Text>
        <Text style={styles.code} selectable>
          {invite.code}
        </Text>
        <View style={styles.buttons}>
          <Pressable style={styles.secondary} onPress={copy}>
            <Text style={styles.secondaryText}>코드 복사</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={share}>
            <Text style={styles.secondaryText}>공유하기</Text>
          </Pressable>
        </View>
        <Text style={styles.muted}>지금까지 {invite.invited}명을 초대했어요.</Text>
      </View>

      {invite.can_redeem && (
        <View style={styles.redeemBox}>
          <Text style={formStyles.label}>친구에게 받은 코드가 있나요?</Text>
          <TextInput
            style={formStyles.input}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="6자리 코드"
            maxLength={CODE_LENGTH}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Text style={formStyles.hint}>
            가입 후 {rules.invite_window_days ?? ""}일 안에 한 번만 입력할 수 있어요 ({formatDate(invite.deadline)}까지)
          </Text>
          {error !== "" && <Text style={formStyles.error}>{error}</Text>}
          <PrimaryButton title="입력" onPress={redeem} disabled={code.trim().length !== CODE_LENGTH} loading={sending} />
        </View>
      )}

      {/* 이렇게 초대해요: 코드 입력 칸이 사라진 뒤에도 방법을 알 수 있게 (2026-11-07 피드백: 아래가 허전함) */}
      <Card>
        <Text style={styles.howTitle}>이렇게 초대해요</Text>
        {[
          "공유하기로 친구에게 내 코드를 보내요",
          `친구가 가입하고 ${rules.invite_window_days ?? ""}일 안에 마이 탭 > 친구 초대에서 코드를 입력해요`,
          `나는 ${formatPoints(invite.inviter_reward)}, 친구는 ${formatPoints(invite.invitee_reward)}를 받아요`,
        ].map((step, i) => (
          <View key={i} style={styles.step}>
            <Text style={styles.stepNo}>{i + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
        {rules.invite_monthly_max !== undefined && (
          <Text style={styles.howNote}>포인트는 한 달에 {rules.invite_monthly_max}명까지 받을 수 있어요.</Text>
        )}
      </Card>
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
    padding: spacing.lg,
    gap: spacing.lg,
  },
  lead: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  codeBox: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    gap: spacing.sm,
  },
  codeLabel: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  code: {
    fontSize: fontSize.hero,
    fontWeight: "800",
    letterSpacing: 4,
    color: colors.primary,
  },
  buttons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  secondary: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryText: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.primary,
  },
  muted: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    textAlign: "center",
  },
  redeemBox: {
    gap: spacing.sm,
  },
  howTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  stepNo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: "hidden",
    textAlign: "center",
    lineHeight: 22,
    fontSize: fontSize.caption,
    fontWeight: "800",
    color: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  stepText: {
    flex: 1,
    fontSize: fontSize.small,
    lineHeight: 22,
    color: colors.text,
  },
  howNote: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
});
