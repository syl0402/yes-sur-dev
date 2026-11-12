// 응답 완료 화면: 보상 받을 휴대폰 번호 남기기 (선택). 그 설문 작성자에게 넘어가는 제3자 제공이라 동의 필수 (2026-11-07)
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { formStyles } from "@/components/create/formStyles";
import PrimaryButton from "@/components/PrimaryButton";
import RewardNotice from "@/components/RewardNotice";
import CheckRow from "@/components/ui/CheckRow";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { fetchRules } from "@/lib/rules";
import { supabase } from "@/lib/supabase";

// onSaved: 번호를 남긴 뒤 (응답 완료 화면 바텀시트를 닫고 카드를 "남겼어요"로 바꾼다, 2026-11-12)
export default function RewardContactForm({
  surveyId,
  note,
  onSaved,
}: {
  surveyId: number;
  note: string;
  onSaved?: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // 이미 남겼는지 (번호는 돌려받지 않음)
  const [left, setLeft] = useState(false);
  const [keepDays, setKeepDays] = useState<number | null>(null);

  useEffect(() => {
    supabase.rpc("has_my_reward_contact", { p_survey_id: surveyId }).then(({ data }) => setLeft(data === true));
    fetchRules(["reward_contact_keep_days"]).then((r) => setKeepDays(r.reward_contact_keep_days ?? null));
  }, [surveyId]);

  const send = async () => {
    if (!phone.trim() || !consent || sending) return;
    setSending(true);
    setError("");
    const { error: sendError } = await supabase.rpc("submit_reward_contact", {
      p_survey_id: surveyId,
      p_phone: phone.trim(),
      p_consent: consent,
    });
    setSending(false);
    if (sendError) {
      setError(errorMessage(sendError));
      return;
    }
    setPhone("");
    setLeft(true);
    onSaved?.();
  };

  const keep = keepDays !== null ? `남긴 날부터 ${keepDays}일 뒤 자동 삭제` : "일정 기간 뒤 자동 삭제";

  return (
    <View style={styles.wrap}>
      <RewardNotice note={note} />

      {left ? (
        <Text style={styles.done}>✓ 보상 받을 연락처를 남겼어요. 바꾸려면 다시 남기면 돼요.</Text>
      ) : (
        <Text style={formStyles.hint}>보상을 받고 싶으면 휴대폰 번호를 남겨 주세요. (선택)</Text>
      )}

      <TextInput
        style={formStyles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="휴대폰 번호"
        keyboardType="phone-pad"
        maxLength={13}
      />
      <CheckRow label="[필수] 개인정보 제3자 제공 동의" checked={consent} onPress={() => setConsent(!consent)} />
      <Pressable onPress={() => setShowTerms(!showTerms)} hitSlop={8}>
        <Text style={styles.termsLink}>{showTerms ? "내용 접기 ▴" : "내용 보기 ▾"}</Text>
      </Pressable>
      {showTerms && (
        <View style={styles.terms}>
          <Text style={styles.termsText}>
            · 받는 사람: 이 설문의 작성자{"\n"}· 목적: 위 보상 안내에 적힌 보상 지급{"\n"}· 항목: 휴대폰 번호{"\n"}· 보관:{" "}
            {keep} (작성자가 지급 후 먼저 지울 수 있어요){"\n"}작성자는 번호만 보고, 내가 어떤 답을 했는지는 알 수 없어요.
            동의하지 않아도 응답과 포인트에는 영향이 없어요. 지우고 싶으면 ‘의견 보내기’로 알려 주세요.
          </Text>
        </View>
      )}

      {error !== "" && <Text style={formStyles.error}>{error}</Text>}
      <PrimaryButton
        title={left ? "번호 바꾸기" : "연락처 남기기"}
        onPress={send}
        disabled={!phone.trim() || !consent}
        loading={sending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "stretch",
    gap: spacing.sm,
  },
  done: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.primary,
  },
  termsLink: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    textDecorationLine: "underline",
  },
  terms: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  termsText: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    lineHeight: 20,
  },
});
