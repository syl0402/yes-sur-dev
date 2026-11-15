// ys-182 전체 알림 보내기 · F-704 (운영자만. 알림을 켠 모든 사용자에게 공지 푸시, 하루 한 번, 2026-11-15)
import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import BottomBar from "@/components/ui/BottomBar";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

// 서버 제한과 같게 (admin_send_notice)
const TITLE_MAX = 30;
const BODY_MAX = 100;

// 알림을 누르면 갈 화면 (서버가 이 4곳만 받는다)
const TARGETS: { label: string; url: string }[] = [
  { label: "홈", url: "/home" },
  { label: "미션", url: "/missions" },
  { label: "설문", url: "/surveys" },
  { label: "커뮤니티", url: "/community" },
];

export default function AdminNotice() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/home");
  // 알림을 켠 사람 수 (확인 창에 보여 준다)
  const [targetCount, setTargetCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.rpc("admin_notice_target_count").then(({ data }) => setTargetCount(typeof data === "number" ? data : null));
  }, []);

  const canSend = title.trim().length > 0 && body.trim().length > 0 && !sending;

  const send = () =>
    showConfirm({
      title: targetCount === null ? "전체 알림을 보낼까요?" : `알림을 켠 ${targetCount}명에게 보낼까요?`,
      message: `${title.trim()}\n${body.trim()}\n\n전체 알림은 하루에 한 번만 보낼 수 있어요.`,
      okLabel: "보내기",
      cancelLabel: "취소",
      onOk: async () => {
        setSending(true);
        setError("");
        const { data, error } = await supabase.rpc("admin_send_notice", { p_title: title, p_body: body, p_url: url });
        setSending(false);
        if (error) {
          setError(errorMessage(error));
          return;
        }
        showNotice("보냈어요", `기기 ${typeof data === "number" ? data : 0}대에 알림을 보냈어요.`);
        router.back();
      },
    });

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "전체 알림 보내기" }} />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.container}
      >
        <Text style={styles.hint}>
          알림을 켠 {targetCount ?? "-"}명에게 가요. 알림을 끈 사람에게는 가지 않아요. 하루에 한 번만 보낼 수 있어요.
        </Text>

        <Text style={styles.label}>제목</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="예) 2주차 업데이트가 나왔어요"
          maxLength={TITLE_MAX}
        />
        <Text style={styles.hint}>
          {title.length} / {TITLE_MAX}자
        </Text>

        <Text style={styles.label}>내용</Text>
        <TextInput
          style={[styles.input, styles.bodyInput]}
          value={body}
          onChangeText={setBody}
          placeholder="예) 앱을 완전히 껐다 켜면 새 버전으로 바뀌어요."
          maxLength={BODY_MAX}
          multiline
        />
        <Text style={styles.hint}>
          {body.length} / {BODY_MAX}자
        </Text>

        <Text style={styles.label}>누르면 갈 화면</Text>
        <View style={styles.chips}>
          {TARGETS.map((t) => (
            <Chip key={t.url} label={t.label} selected={url === t.url} onPress={() => setUrl(t.url)} />
          ))}
        </View>

        {error !== "" && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <BottomBar>
        <Button title="보내기" onPress={send} disabled={!canSend} loading={sending} style={styles.button} />
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
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.textMuted,
  },
  input: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    fontSize: fontSize.body,
    color: colors.text,
  },
  bodyInput: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
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
