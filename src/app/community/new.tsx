// ys-142 투표 만들기 · F-603 (밸런스 · 나만 그래? · 골라 줘)
import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import Chips from "@/components/create/Chips";
import { formStyles } from "@/components/create/formStyles";
import PrimaryButton from "@/components/PrimaryButton";
import { colors, fontSize, spacing } from "@/constants/theme";
import { KIND_HINTS, KIND_LABELS, type PostKind } from "@/lib/community";
import { errorMessage } from "@/lib/errors";
import { fetchRules } from "@/lib/rules";
import { supabase } from "@/lib/supabase";

// 서버 create_post와 같은 규칙 (서버가 한 번 더 검사한다)
const QUESTION_MAX = 100;
const OPTION_MAX = 30;
const PICK_MAX_OPTIONS = 4;

const KINDS = (Object.keys(KIND_LABELS) as PostKind[]).map((k) => ({ value: k, label: KIND_LABELS[k] }));

export default function NewPost() {
  const [kind, setKind] = useState<PostKind>("balance");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // 하루 최대 글 수 (안내 문구용, point_rules)
  const [dailyMax, setDailyMax] = useState<number | null>(null);

  useEffect(() => {
    fetchRules(["post_daily_max"]).then((r) => setDailyMax(r.post_daily_max ?? null));
  }, []);

  const needsOptions = kind !== "relate";
  const filled = options.map((o) => o.trim());
  const optionsOk = !needsOptions || (filled.every((o) => o.length > 0) && new Set(filled).size === filled.length);
  const canSend = question.trim().length > 0 && optionsOk;

  const changeKind = (k: PostKind) => {
    setKind(k);
    // 밸런스는 보기 2개 고정
    if (k === "balance") setOptions((o) => [o[0] ?? "", o[1] ?? ""]);
  };

  const setOption = (i: number, text: string) => setOptions((o) => o.map((v, j) => (j === i ? text : v)));

  const send = async () => {
    if (!canSend || sending) return;
    setSending(true);
    setError("");
    const { data, error: sendError } = await supabase.rpc("create_post", {
      p_kind: kind,
      p_question: question.trim(),
      p_options: needsOptions ? filled : undefined,
    });
    setSending(false);
    if (sendError) {
      setError(errorMessage(sendError));
      return;
    }
    // 만든 글로 바로 이동 (뒤로 가기로 만들기 화면에 돌아오지 않게)
    router.replace({ pathname: "/community/[id]", params: { id: String(data) } });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "투표 만들기" }} />

      <Text style={formStyles.label}>종류</Text>
      <Chips options={KINDS} selected={kind} onSelect={changeKind} />
      <Text style={formStyles.hint}>{KIND_HINTS[kind]}</Text>

      <Text style={formStyles.label}>질문</Text>
      <TextInput
        style={formStyles.input}
        value={question}
        onChangeText={setQuestion}
        placeholder={kind === "relate" ? "나만 그런지 궁금한 상황을 적어 주세요" : "무엇을 물어볼까요?"}
        maxLength={QUESTION_MAX}
      />

      {needsOptions ? (
        <>
          <Text style={formStyles.label}>보기</Text>
          {options.map((o, i) => (
            <View key={i} style={styles.optionRow}>
              <TextInput
                style={[formStyles.input, styles.optionInput]}
                value={o}
                onChangeText={(t) => setOption(i, t)}
                placeholder={kind === "balance" ? (i === 0 ? "A" : "B") : `보기 ${i + 1}`}
                maxLength={OPTION_MAX}
              />
              {kind === "pick" && options.length > 2 && (
                <Pressable onPress={() => setOptions((all) => all.filter((_, j) => j !== i))} hitSlop={8}>
                  <Text style={styles.remove}>삭제</Text>
                </Pressable>
              )}
            </View>
          ))}
          {kind === "pick" && options.length < PICK_MAX_OPTIONS && (
            <Pressable onPress={() => setOptions((all) => [...all, ""])}>
              <Text style={styles.add}>+ 보기 추가</Text>
            </Pressable>
          )}
          {!optionsOk && filled.every((x) => x.length > 0) && <Text style={formStyles.error}>보기가 서로 달라야 해요.</Text>}
        </>
      ) : (
        <Text style={formStyles.hint}>보기는 &lsquo;나도 그래 / 나는 아냐&rsquo;로 정해져 있어요.</Text>
      )}

      <Text style={formStyles.hint}>
        욕설·혐오, 개인정보를 묻는 글은 신고되면 숨겨지고 삭제될 수 있어요.
        {dailyMax !== null ? ` 하루에 ${dailyMax}개까지 만들 수 있어요.` : ""}
      </Text>

      {error !== "" && <Text style={formStyles.error}>{error}</Text>}

      <PrimaryButton title="올리기" onPress={send} disabled={!canSend} loading={sending} />
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
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  optionInput: {
    flex: 1,
  },
  remove: {
    fontSize: fontSize.small,
    color: colors.danger,
  },
  add: {
    fontSize: fontSize.body,
    color: colors.primary,
    fontWeight: "600",
  },
});
