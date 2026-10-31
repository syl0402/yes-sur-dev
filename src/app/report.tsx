// ys-160 신고 · F-801 (설문 · 커뮤니티 글 · 댓글. 서로 다른 n명이 신고하면 자동 숨김 → 운영자 확인)
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

import Chips from "@/components/create/Chips";
import { formStyles } from "@/components/create/formStyles";
import PrimaryButton from "@/components/PrimaryButton";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

type Reason = "spam" | "abuse" | "privacy" | "sexual" | "other";

const REASONS: { value: Reason; label: string }[] = [
  { value: "spam", label: "스팸·광고" },
  { value: "abuse", label: "욕설·혐오" },
  { value: "privacy", label: "개인정보 요구" },
  { value: "sexual", label: "성적인 내용" },
  { value: "other", label: "기타" },
];

const DETAIL_MAX = 200;

// 신고 대상 종류 → 화면 제목
const TITLES: Record<string, string> = {
  survey: "설문 신고",
  post: "글 신고",
  comment: "댓글 신고",
};

export default function Report() {
  // ?survey=번호 (설문, 예전 방식) 또는 ?type=post|comment&id=번호
  const params = useLocalSearchParams<{ survey?: string; type?: string; id?: string }>();
  const type = params.survey ? "survey" : (params.type ?? "survey");
  const targetId = Number(params.survey ?? params.id);
  const [reason, setReason] = useState<Reason | null>(null);
  const [detail, setDetail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    if (!reason || sending) return;
    setSending(true);
    setError("");
    const { error: reportError } = await supabase.rpc("report_content", {
      p_type: type,
      p_id: targetId,
      p_reason: reason,
      p_detail: detail.trim() || undefined,
    });
    setSending(false);
    if (reportError) {
      setError(errorMessage(reportError));
      return;
    }
    showNotice("신고가 접수됐어요", "운영자가 확인할게요. 알려 주셔서 고마워요.", () => router.back());
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: TITLES[type] ?? "신고" }} />

      <Text style={formStyles.label}>신고 사유</Text>
      <Chips options={REASONS} selected={reason} onSelect={setReason} />

      <Text style={formStyles.label}>자세한 내용 (선택)</Text>
      <TextInput
        style={[formStyles.input, formStyles.multiline]}
        value={detail}
        onChangeText={setDetail}
        placeholder="어떤 점이 문제인지 알려 주세요"
        maxLength={DETAIL_MAX}
        multiline
      />
      <Text style={formStyles.hint}>
        {detail.length} / {DETAIL_MAX}자{"\n"}
        신고한 사람은 등록자에게 알려지지 않아요. 허위 신고가 반복되면 이용이 제한될 수 있어요.
      </Text>

      {error !== "" && <Text style={formStyles.error}>{error}</Text>}

      <PrimaryButton title="신고하기" onPress={send} disabled={!reason} loading={sending} />
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
});
