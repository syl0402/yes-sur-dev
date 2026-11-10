// ys-122 설문 수정 (설명·보상 안내만) · F-406 확장 (2026-11-08 팀 피드백, 2026-11-10 응답 0명이면 처음부터 다시 고치기)
// 진행 중인 내 설문의 안내 글만 고친다. 문항·제목·인원은 응답이 섞이지 않게 잠금 (시중 설문 서비스와 같게)
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import { formStyles } from "@/components/create/formStyles";
import PrimaryButton from "@/components/PrimaryButton";
import Button from "@/components/ui/Button";
import CheckRow from "@/components/ui/CheckRow";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import { showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { formatPoints } from "@/lib/format";
import { showNotice } from "@/lib/notice";
import { fetchSurveyReward } from "@/lib/rewards";
import { supabase } from "@/lib/supabase";
import {
  DESCRIPTION_MAX,
  REWARD_NOTE_MAX,
  REWARD_NOTE_MIN,
  deleteDraft,
  fetchSurveyAsDraft,
  makeRequestId,
  saveDraft,
} from "@/lib/surveyDraft";

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
  // 응답이 0명이면 "처음부터 다시 고치기"를 보여 준다 (2026-11-10)
  const [noResponses, setNoResponses] = useState(false);
  const [redoing, setRedoing] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("surveys").select("description, response_count").eq("id", surveyId).maybeSingle(),
      fetchSurveyReward(surveyId),
    ]).then(([{ data }, reward]) => {
      setDescription(data?.description ?? "");
      setNoResponses(data?.response_count === 0);
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

  // 처음부터 다시 고치기: 지금 내용을 임시저장으로 옮기고 → 설문 삭제(등록비 환불) → 작성 화면
  // 임시저장을 먼저 만들어서, 삭제가 실패하면 그 임시저장만 지운다
  const redo = async () => {
    setRedoing(true);
    const [{ data: auth }, draft] = await Promise.all([supabase.auth.getUser(), fetchSurveyAsDraft(surveyId)]);
    const userId = auth.user?.id;
    if (!userId || !draft) {
      setRedoing(false);
      showNotice("불러오지 못했어요", "잠시 후 다시 시도해 주세요.");
      return;
    }
    const draftId = makeRequestId();
    saveDraft(userId, draftId, draft, 1);
    const { data, error: deleteError } = await supabase.rpc("delete_survey", { p_survey_id: surveyId });
    setRedoing(false);
    if (deleteError) {
      deleteDraft(userId, draftId);
      showNotice("다시 고치지 못했어요", errorMessage(deleteError));
      return;
    }
    const refund = typeof data === "number" ? data : 0;
    const open = () => {
      // 지운 설문의 상세·수정 화면으로 돌아가지 않게 처음 화면까지 닫고 작성 화면을 연다
      router.dismissAll();
      router.push({ pathname: "/create", params: { draft: draftId } });
    };
    showNotice(
      "작성 화면으로 옮겼어요",
      `${refund > 0 ? `등록비 ${formatPoints(refund)}를 돌려드렸어요. ` : ""}고친 뒤 다시 등록해 주세요. 임시저장함에도 있어요.`,
      open,
    );
  };

  const confirmRedo = () =>
    showConfirm({
      title: "처음부터 다시 고칠까요?",
      message: "지금 설문은 지우고 낸 등록비를 돌려드려요. 같은 내용이 채워진 작성 화면이 열리고, 다시 등록하면 등록비를 새로 내요.",
      okLabel: "다시 고치기",
      cancelLabel: "취소",
      onOk: redo,
    });

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

      {noResponses ? (
        <View style={formStyles.card}>
          <Text style={formStyles.label}>문항·제목·인원까지 고치고 싶다면</Text>
          <Text style={formStyles.hint}>
            아직 응답이 없어서 처음부터 다시 고칠 수 있어요. 응답이 1명이라도 생기면 설명과 보상 안내만 고칠 수 있어요.
          </Text>
          <Button title="처음부터 다시 고치기" variant="outline" onPress={confirmRedo} disabled={redoing} />
        </View>
      ) : (
        <Text style={styles.lead}>
          응답이 생겨서 설명과 보상 안내만 고칠 수 있어요.{"\n"}문항·제목·인원은 이미 받은 응답과 맞지 않게 되어 고칠 수 없어요.
        </Text>
      )}

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
        <Text style={formStyles.label}>응답자 보상 (선택)</Text>
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
            "예) 응답해 주신 분들 중 10분을 추첨해 스타벅스 아메리카노 기프티콘을 드려요. 당첨자는 12월 1일에 문자로 개별 안내해 드릴게요."
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
