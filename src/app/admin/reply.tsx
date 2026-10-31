// ys-181 의견 답변 · F-704 (운영자만. 답변은 보낸 사람의 "내가 보낸 의견"에 보인다, 2026-10-31)
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import BottomBar from "@/components/ui/BottomBar";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

// 서버 제한과 같게 (admin_reply_feedback)
const REPLY_MAX = 1000;

export default function AdminReply() {
  // 목록에서 넘겨받은 의견 (다시 불러오지 않는다)
  const { id, body } = useLocalSearchParams<{ id: string; body?: string }>();
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState<"" | "answered" | "done">("");
  const [error, setError] = useState("");

  const canSend = reply.trim().length > 0 && sending === "";

  const send = async (status: "answered" | "done") => {
    setSending(status);
    setError("");
    const { error } = await supabase.rpc("admin_reply_feedback", {
      p_id: Number(id),
      p_reply: reply,
      p_status: status,
    });
    setSending("");
    if (error) {
      setError(errorMessage(error));
      return;
    }
    router.back();
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "의견 답변" }} />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.container}
      >
        {body ? (
          <Card>
            <Text style={styles.label}>받은 의견</Text>
            <Text style={styles.body}>{body}</Text>
          </Card>
        ) : null}

        <Text style={styles.label}>답변</Text>
        <TextInput
          style={styles.input}
          value={reply}
          onChangeText={setReply}
          placeholder="보낸 분이 '내가 보낸 의견'에서 볼 수 있어요."
          maxLength={REPLY_MAX}
          multiline
        />
        <Text style={styles.hint}>
          {reply.length} / {REPLY_MAX.toLocaleString()}자 · [반영함]은 실제로 고쳤거나 넣었을 때
        </Text>
        {error !== "" && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <BottomBar>
        <Button
          title="답변함"
          variant="outline"
          onPress={() => send("answered")}
          disabled={!canSend}
          loading={sending === "answered"}
          style={styles.button}
        />
        <Button
          title="반영함"
          onPress={() => send("done")}
          disabled={!canSend}
          loading={sending === "done"}
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
  label: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.textMuted,
  },
  body: {
    fontSize: fontSize.body,
    color: colors.text,
    lineHeight: 24,
  },
  input: {
    minHeight: 160,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    fontSize: fontSize.body,
    color: colors.text,
    textAlignVertical: "top",
  },
  hint: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  error: {
    fontSize: fontSize.small,
    color: colors.danger,
  },
  button: {
    flex: 1,
  },
});
