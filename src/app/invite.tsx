// ys-156 친구 초대 · F-905 (내 초대 코드 복사·공유 + 가입 직후 친구 코드 입력, 기간은 point_rules)
import * as Clipboard from "expo-clipboard";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";

import { formStyles } from "@/components/create/formStyles";
import PrimaryButton from "@/components/PrimaryButton";
import { colors, fontSize, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatPoints } from "@/lib/format";
import { showNotice } from "@/lib/notice";
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

  const load = useCallback(() => {
    supabase.rpc("get_my_invite").then(({ data, error: loadError }) => {
      setInvite(loadError ? errorMessage(loadError) : (data as Invite));
    });
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

  const share = () => {
    Share.share({ message }).catch(() => undefined);
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
          <Text style={formStyles.hint}>{formatDate(invite.deadline)}까지 한 번만 입력할 수 있어요.</Text>
          {error !== "" && <Text style={formStyles.error}>{error}</Text>}
          <PrimaryButton title="입력" onPress={redeem} disabled={code.trim().length !== CODE_LENGTH} loading={sending} />
        </View>
      )}
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
    borderRadius: 12,
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
    borderRadius: 10,
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
});
