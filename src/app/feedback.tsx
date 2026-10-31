// ys-170 의견 보내기 · F-902 (버그·불편·제안 → 운영자 답변을 "내가 보낸 의견"에서 확인)
import Constants from "expo-constants";
import * as Device from "expo-device";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";

import Chips from "@/components/create/Chips";
import { formStyles } from "@/components/create/formStyles";
import PrimaryButton from "@/components/PrimaryButton";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, radius, shadow, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

type Category = "bug" | "inconvenience" | "idea" | "other";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "bug", label: "버그·오류" },
  { value: "inconvenience", label: "불편해요" },
  { value: "idea", label: "제안" },
  { value: "other", label: "기타" },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "확인 중",
  answered: "답변 완료",
  done: "반영 완료",
};

const BODY_MAX = 1000;

type MyFeedback = {
  id: number;
  category: Category;
  body: string;
  status: string;
  reply: string | null;
  created_at: string;
};

// 버그를 다시 만들어 보는 데 필요한 기기 정보 (개인정보 아님)
function deviceInfo() {
  return {
    os: Platform.OS,
    osVersion: String(Platform.Version),
    model: Device.modelName ?? null,
    appVersion: Constants.expoConfig?.version ?? null,
  };
}

export default function Feedback() {
  // from: 어느 화면에서 들어왔는지 (마이 탭, 내 정보 등)
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [mine, setMine] = useState<MyFeedback[]>([]);

  const load = useCallback(() => {
    supabase
      .from("feedback")
      .select("id, category, body, status, reply, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setMine((data as MyFeedback[] | null) ?? []));
  }, []);

  useFocusEffect(load);

  const send = async () => {
    if (!category || !body.trim() || sending) return;
    setSending(true);
    setError("");
    const { error: sendError } = await supabase.rpc("send_feedback", {
      p_category: category,
      p_body: body.trim(),
      p_screen: from ?? undefined,
      p_device: deviceInfo(),
    });
    setSending(false);
    if (sendError) {
      setError(errorMessage(sendError));
      return;
    }
    setCategory(null);
    setBody("");
    load();
    showNotice("의견을 보냈어요", "꼼꼼히 읽고 답변할게요. 아래 '내가 보낸 의견'에서 확인할 수 있어요.");
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "의견 보내기" }} />

      <Text style={styles.lead}>불편한 점, 오류, 바라는 기능을 알려 주세요. 옛썰을 고치는 데 바로 써요.</Text>

      <Text style={formStyles.label}>종류</Text>
      <Chips options={CATEGORIES} selected={category} onSelect={setCategory} />

      <Text style={formStyles.label}>내용</Text>
      <TextInput
        style={[formStyles.input, formStyles.multiline, styles.body]}
        value={body}
        onChangeText={setBody}
        placeholder="예: 설문 응답 화면에서 [다음]을 눌러도 안 넘어가요"
        maxLength={BODY_MAX}
        multiline
      />
      <Text style={formStyles.hint}>
        {body.length} / {BODY_MAX}자{"\n"}
        오류를 고치는 데 필요해서 기기 종류·앱 버전이 함께 보내져요 (이름·연락처는 보내지 않아요).
      </Text>

      {error !== "" && <Text style={formStyles.error}>{error}</Text>}

      <PrimaryButton title="보내기" onPress={send} disabled={!category || !body.trim()} loading={sending} />

      {mine.length > 0 && (
        <View style={styles.section}>
          <Text style={formStyles.label}>내가 보낸 의견</Text>
          {mine.map((f) => (
            <View key={f.id} style={styles.item}>
              <View style={styles.itemHead}>
                <Text style={styles.meta}>
                  {CATEGORIES.find((c) => c.value === f.category)?.label ?? "기타"} · {formatDate(f.created_at)}
                </Text>
                <Text style={[styles.status, f.status !== "pending" && styles.statusDone]}>
                  {STATUS_LABELS[f.status] ?? "확인 중"}
                </Text>
              </View>
              <Text style={styles.itemBody}>{f.body}</Text>
              {f.reply ? (
                <View style={styles.reply}>
                  <Text style={styles.replyLabel}>옛썰 답변</Text>
                  <Text style={styles.itemBody}>{f.reply}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  lead: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  body: {
    minHeight: 140,
  },
  section: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  item: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.sm,
    ...shadow.card,
  },
  itemHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  meta: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  status: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    fontWeight: "600",
  },
  statusDone: {
    color: colors.primary,
  },
  itemBody: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  reply: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    gap: 2,
  },
  replyLabel: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.primary,
  },
});
