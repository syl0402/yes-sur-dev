// ys-182 단체 거절 사유 · F-704 (운영자만. 단체는 가입 대기 화면에서 사유를 보고 다시 신청한다, 2026-10-31)
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import Chips from "@/components/create/Chips";
import BottomBar from "@/components/ui/BottomBar";
import Button from "@/components/ui/Button";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

// 서버 제한과 같게 (admin_decide_org)
const REASON_MAX = 200;

// 자주 쓰는 사유 (누르면 입력칸에 채워지고 고칠 수 있다)
const QUICK_REASONS = [
  "증빙 링크가 열리지 않아요. 공식 SNS나 홈페이지 주소를 다시 넣어 주세요.",
  "증빙 링크에서 단체를 확인할 수 없어요. 단체 이름이 보이는 공식 페이지를 넣어 주세요.",
  "단체 공식 메일이 아닌 것 같아요. 단체에서 쓰는 메일로 다시 가입해 주세요.",
];

export default function AdminReject() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    setSending(true);
    setError("");
    const { error } = await supabase.rpc("admin_decide_org", {
      p_user_id: id,
      p_approve: false,
      p_reason: reason,
    });
    setSending(false);
    if (error) {
      setError(errorMessage(error));
      return;
    }
    router.back();
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "단체 거절" }} />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.container}
      >
        <Text style={styles.heading}>{name ?? "단체"} 거절 사유</Text>
        <Text style={styles.hint}>단체가 가입 대기 화면에서 이 사유를 보고 고쳐서 다시 신청해요.</Text>

        <Chips
          options={QUICK_REASONS.map((r, i) => ({ value: i, label: r.split(".")[0] }))}
          selected={QUICK_REASONS.indexOf(reason)}
          onSelect={(i) => setReason(QUICK_REASONS[i])}
        />

        <TextInput
          style={styles.input}
          value={reason}
          onChangeText={setReason}
          placeholder="거절 사유를 입력해 주세요"
          maxLength={REASON_MAX}
          multiline
        />
        <Text style={styles.hint}>
          {reason.length} / {REASON_MAX}자
        </Text>
        {error !== "" && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <BottomBar>
        <Button
          title="거절하기"
          onPress={send}
          disabled={reason.trim().length === 0}
          loading={sending}
          style={styles.button}
        />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  heading: {
    fontSize: fontSize.subtitle,
    fontWeight: "700",
    color: colors.text,
  },
  hint: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  input: {
    minHeight: 120,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    fontSize: fontSize.body,
    color: colors.text,
    textAlignVertical: "top",
  },
  error: {
    fontSize: fontSize.small,
    color: colors.danger,
  },
  button: {
    flex: 1,
  },
});
