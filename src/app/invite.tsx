// ys-156 친구 초대 · F-905 (내 초대 코드 복사·공유 + 가입 직후 친구 코드 입력, 기간은 point_rules. 2026-11-10 화면 정리)
import * as Clipboard from "expo-clipboard";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";

import { formStyles } from "@/components/create/formStyles";
import PrimaryButton from "@/components/PrimaryButton";
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

      {/* 맨 위: 무엇을 받는지 한눈에 (2026-11-10 정리) */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>친구 초대하고{"\n"}함께 포인트 받기</Text>
        <Text style={styles.heroSub}>
          친구가 내 코드를 입력하면 나는 <Text style={styles.heroStrong}>{formatPoints(invite.inviter_reward)}</Text>, 친구는{" "}
          <Text style={styles.heroStrong}>{formatPoints(invite.invitee_reward)}</Text>를 받아요.
        </Text>
      </View>

      {/* 내 초대 코드: 연파랑 상자 + 복사(흰) · 공유(파랑) */}
      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>내 초대 코드</Text>
        <Text style={styles.code} selectable>
          {invite.code}
        </Text>
        <Text style={styles.invited}>지금까지 {invite.invited}명을 초대했어요</Text>
        <View style={styles.buttons}>
          <Pressable style={({ pressed }) => [styles.button, styles.copyButton, pressed && styles.pressed]} onPress={copy}>
            <Text style={styles.copyText}>코드 복사</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.button, styles.shareButton, pressed && styles.pressed]} onPress={share}>
            <Text style={styles.shareText}>공유하기</Text>
          </Pressable>
        </View>
      </View>

      {invite.can_redeem && (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>친구에게 받은 코드가 있나요?</Text>
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

      {/* 이렇게 초대해요: 선 없는 연회색 상자 (코드 입력 칸이 사라진 뒤에도 방법을 알 수 있게) */}
      <View style={styles.group}>
        <Text style={styles.groupTitle}>이렇게 초대해요</Text>
        <View style={styles.howBox}>
          {[
            "공유하기로 친구에게 내 코드를 보내요",
            `친구가 가입하고 ${rules.invite_window_days ?? ""}일 안에 마이 탭 > 친구 초대에서 코드를 입력해요`,
            `나는 ${formatPoints(invite.inviter_reward)}, 친구는 ${formatPoints(invite.invitee_reward)}를 받아요`,
          ].map((step, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepNo}>
                <Text style={styles.stepNoText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
        {rules.invite_monthly_max !== undefined && (
          <Text style={styles.howNote}>포인트는 한 달에 {rules.invite_monthly_max}명까지 받을 수 있어요.</Text>
        )}
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
    gap: 28,
  },
  hero: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  heroTitle: {
    fontSize: fontSize.title,
    fontWeight: "700",
    lineHeight: 30,
    color: colors.text,
  },
  heroSub: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  heroStrong: {
    fontWeight: "700",
    color: colors.primary,
  },
  codeBox: {
    padding: spacing.lg,
    gap: 6,
    borderRadius: radius.xl,
    alignItems: "center",
    backgroundColor: colors.primarySoft,
  },
  codeLabel: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.textMuted,
  },
  code: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: 6,
    color: colors.primary,
  },
  invited: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  buttons: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    alignSelf: "stretch",
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
  },
  copyButton: {
    backgroundColor: colors.surface,
  },
  shareButton: {
    backgroundColor: colors.primary,
  },
  copyText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
  },
  shareText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  pressed: {
    opacity: 0.7,
  },
  muted: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    textAlign: "center",
  },
  // 묶음: 작은 회색 제목 + 내용 (내 정보 화면과 같은 모양)
  group: {
    gap: spacing.sm,
  },
  groupTitle: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.textMuted,
  },
  howBox: {
    padding: 18,
    gap: 14,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  stepNo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  stepNoText: {
    fontSize: fontSize.caption,
    fontWeight: "800",
    color: colors.primary,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
  },
  howNote: {
    paddingHorizontal: spacing.xs,
    fontSize: fontSize.caption,
    color: colors.textSubtle,
  },
});
