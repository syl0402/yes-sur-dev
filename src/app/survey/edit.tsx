// ys-122 설문 수정 (설명·보상 안내만) · F-406 확장 (2026-11-08 팀 피드백)
// 진행 중인 내 설문의 안내 글만 고친다. 문항·제목·인원은 응답이 섞이지 않게 잠금 (시중 설문 서비스와 같게)
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import { formStyles } from "@/components/create/formStyles";
import PrimaryButton from "@/components/PrimaryButton";
import CheckRow from "@/components/ui/CheckRow";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { showNotice } from "@/lib/notice";
import { fetchSurveyReward } from "@/lib/rewards";
import { supabase } from "@/lib/supabase";
import { DESCRIPTION_MAX, REWARD_NOTE_MAX, REWARD_NOTE_MIN } from "@/lib/surveyDraft";

export default function SurveyEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const surveyId = Number(id);
  const [loaded, setLoaded] = useState(false);
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  // 처음 보상 안내 (이미 켠 설문은 지울 수 없고 고치기만)
  const [originalNote, setOriginalNote] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("surveys").select("description").eq("id", surveyId).maybeSingle(),
      fetchSurveyReward(surveyId),
    ]).then(([{ data }, reward]) => {
      setDescription(data?.description ?? "");
      setNote(reward ?? "");
      setOriginalNote(reward);
      setLoaded(true);
    });
  }, [surveyId]);

  const trimmedNote = note.trim();
  // 보상 안내를 새로 쓰거나 바꾸면 작성자 동의를 다시 받는다
  const noteChanged = trimmedNote !== "" && trimmedNote !== (originalNote ?? "");
  const noteBad =
    (originalNote !== null && trimmedNote === "") ||
    (trimmedNote !== "" && (trimmedNote.length < REWARD_NOTE_MIN || trimmedNote.length > REWARD_NOTE_MAX));
  const ready = !noteBad && (!noteChanged || agreed) && description.trim().length <= DESCRIPTION_MAX;

  const save = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    const { error: saveError } = await supabase.rpc("update_survey_texts", {
      p_survey_id: surveyId,
      p_description: description.trim(),
      p_reward_note: trimmedNote,
    });
    setSaving(false);
    if (saveError) {
      setError(errorMessage(saveError));
      return;
    }
    showNotice("수정했어요", "바뀐 내용이 응답자에게 바로 보여요.", () => router.back());
  };

  if (!loaded) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "설문 수정" }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "설문 수정" }} />

      <Text style={styles.lead}>
        설명과 보상 안내만 수정할 수 있어요.{"\n"}문항·제목·인원은 이미 받은 응답과 맞지 않게 되어 수정할 수 없어요.
      </Text>

      <View style={formStyles.card}>
        <Text style={formStyles.label}>설명 (선택)</Text>
        <TextInput
          style={[formStyles.input, formStyles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="설문 목적이나 응답자에게 알릴 내용을 적어 주세요."
          maxLength={DESCRIPTION_MAX}
          multiline
        />
        <Text style={formStyles.hint}>
          {description.length} / {DESCRIPTION_MAX}자
        </Text>
      </View>

      <View style={formStyles.card}>
        <Text style={formStyles.label}>🎁 응답자 보상 (선택)</Text>
        <Text style={formStyles.hint}>
          {originalNote !== null
            ? "이미 연락처를 남긴 사람이 있을 수 있어 보상 안내는 지울 수 없고 수정만 할 수 있어요."
            : "기프티콘 등 보상을 준다면 안내를 적어 주세요. 없으면 비워 두면 돼요."}
        </Text>
        <TextInput
          style={[formStyles.input, formStyles.multiline]}
          value={note}
          onChangeText={setNote}
          placeholder={
            "예) 응답해 주신 분 중 추첨으로 10분께 스타벅스 아메리카노 기프티콘을 드려요. 당첨자는 12월 1일에 문자로 보내 드릴게요."
          }
          maxLength={REWARD_NOTE_MAX}
          multiline
        />
        {trimmedNote !== "" && (
          <Text style={formStyles.hint}>
            {note.length} / {REWARD_NOTE_MAX}자 · 응답자가 원하면 휴대폰 번호를 남겨요. 번호는 나만 볼 수 있어요.
          </Text>
        )}
        {noteChanged && (
          <CheckRow
            label="[필수] 받은 연락처는 보상 지급에만 쓰고, 지급 후 지울게요."
            checked={agreed}
            onPress={() => setAgreed(!agreed)}
          />
        )}
      </View>

      {error !== "" && <Text style={formStyles.error}>{error}</Text>}
      <PrimaryButton title="저장" onPress={save} disabled={!ready} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  lead: {
    fontSize: fontSize.body,
    lineHeight: 22,
    color: colors.text,
  },
});
