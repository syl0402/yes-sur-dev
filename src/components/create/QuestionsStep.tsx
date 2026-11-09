import { Pressable, StyleSheet, View } from "react-native";

import Chips from "@/components/create/Chips";
import { formStyles } from "@/components/create/formStyles";
import CheckRow from "@/components/ui/CheckRow";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, radius, shadow, spacing } from "@/constants/theme";
import {
  type DraftQuestion,
  NONE_OPTION_LABEL,
  OPTION_TEXT_MAX,
  OTHER_OPTION_LABEL,
  QUESTION_TEXT_MAX,
  QUESTION_TYPE_LABELS,
  type QuestionType,
  SCALE_LABELS,
  type SurveyDraft,
  isChoice,
  newQuestion,
} from "@/lib/surveyDraft";

type Props = {
  draft: SurveyDraft;
  rules: Record<string, number>;
  onChange: (patch: Partial<SurveyDraft>) => void;
};

const TYPE_OPTIONS = (Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => ({
  value: t,
  label: QUESTION_TYPE_LABELS[t],
}));

// 작성 ② 문항 카드 목록 (추가·수정·삭제·순서 바꾸기 · 2026-11-10 선택 주관식·해당 없음·기타·보기 섞기)
export default function QuestionsStep({ draft, rules, onChange }: Props) {
  const questions = draft.questions;
  const maxQuestions = rules.survey_max_questions;

  const setQuestions = (next: DraftQuestion[]) => onChange({ questions: next });
  const update = (index: number, patch: Partial<DraftQuestion>) =>
    setQuestions(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));

  const move = (index: number, delta: number) => {
    const next = [...questions];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setQuestions(next);
  };

  const remove = (index: number) => setQuestions(questions.filter((_, i) => i !== index));

  // 고르기 문항으로 바꿀 때 보기가 2개보다 적으면 빈 칸을 채워 둔다
  const changeType = (index: number, type: QuestionType) => {
    const q = questions[index];
    const options = isChoice(type) && q.options.length < 2 ? ["", ""] : q.options;
    update(index, { type, options });
  };

  return (
    <>
      <Text style={formStyles.hint}>
        문항 {questions.length} / {maxQuestions}개 · 문항이 {rules.attention_min_questions}개 이상이면 성실한 응답 확인용
        문항이 자동으로 1개 들어가요.
      </Text>

      {questions.map((q, index) => (
        <View key={q.key} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>문항 {index + 1}</Text>
            <View style={styles.cardActions}>
              <SmallButton label="↑" onPress={() => move(index, -1)} disabled={index === 0} />
              <SmallButton label="↓" onPress={() => move(index, 1)} disabled={index === questions.length - 1} />
              <SmallButton label="삭제" onPress={() => remove(index)} disabled={questions.length === 1} danger />
            </View>
          </View>

          <Chips options={TYPE_OPTIONS} selected={q.type} onSelect={(type) => changeType(index, type)} />

          <TextInput
            style={formStyles.input}
            value={q.text}
            onChangeText={(text) => update(index, { text })}
            placeholder="질문을 입력해 주세요"
            maxLength={QUESTION_TEXT_MAX}
            multiline
          />

          {isChoice(q.type) && (
            <View style={formStyles.section}>
              {q.options.map((option, oi) => (
                <View key={oi} style={styles.optionRow}>
                  <TextInput
                    style={[formStyles.input, styles.optionInput]}
                    value={option}
                    onChangeText={(text) =>
                      update(index, { options: q.options.map((o, j) => (j === oi ? text : o)) })
                    }
                    placeholder={`보기 ${oi + 1}`}
                    maxLength={OPTION_TEXT_MAX}
                  />
                  {q.options.length > 2 && (
                    <SmallButton
                      label="✕"
                      onPress={() => update(index, { options: q.options.filter((_, j) => j !== oi) })}
                    />
                  )}
                </View>
              ))}
              {/* 해당 없음·기타: 문구 고정, 항상 맨 아래 (2026-11-10) */}
              {q.none && <FixedOption label={NONE_OPTION_LABEL} onRemove={() => update(index, { none: false })} />}
              {q.other && <FixedOption label={OTHER_OPTION_LABEL} onRemove={() => update(index, { other: false })} />}
              {/* 보기 추가: 점선 버튼 한 줄 / 그 아래 해당 없음·기타 알약 버튼 (구글폼 "옵션 추가 또는 '기타' 추가"처럼) */}
              {q.options.length < rules.survey_max_options && (
                <Pressable
                  style={styles.addOption}
                  onPress={() => update(index, { options: [...q.options, ""] })}
                  hitSlop={4}
                >
                  <Text style={styles.addText}>+ 보기 추가</Text>
                </Pressable>
              )}
              {(!q.none || !q.other) && (
                <View style={styles.quickRow}>
                  {!q.none && <QuickAdd label="+ 해당 없음" onPress={() => update(index, { none: true })} />}
                  {!q.other && <QuickAdd label="+ 기타 (직접 입력)" onPress={() => update(index, { other: true })} />}
                </View>
              )}
              <View style={styles.divider} />
              <CheckRow
                label="보기 순서 섞기"
                checked={q.shuffle === true}
                onPress={() => update(index, { shuffle: q.shuffle !== true })}
              />
              {q.shuffle === true && (
                <Text style={formStyles.hint}>응답자마다 보기 순서가 달라요. 해당 없음·기타는 늘 맨 아래예요.</Text>
              )}
            </View>
          )}

          {q.type === "scale" && (
            <Text style={formStyles.hint}>
              응답자는 1({SCALE_LABELS[0]}) ~ 5({SCALE_LABELS[4]}) 중에서 골라요.
            </Text>
          )}
          {q.type === "text" && (
            <>
              <Text style={formStyles.hint}>
                응답자가 글로 답해요 (최대 {rules.answer_text_max}자). 주관식 답은 등록자만 볼 수 있어요.
              </Text>
              <CheckRow
                label="필수 문항 (끄면 응답자가 비워 두고 넘어갈 수 있어요)"
                checked={q.required !== false}
                onPress={() => update(index, { required: q.required === false })}
              />
            </>
          )}
        </View>
      ))}

      {questions.length < maxQuestions && (
        <Pressable style={styles.addQuestion} onPress={() => setQuestions([...questions, newQuestion()])}>
          <Text style={styles.addText}>+ 문항 추가</Text>
        </Pressable>
      )}
    </>
  );
}

// 해당 없음·기타 추가 버튼 (테두리 알약)
function QuickAdd({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.quickAdd} onPress={onPress} hitSlop={4}>
      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );
}

// 고정 문구 보기 (해당 없음·기타): 고칠 수 없고 ✕로 빼기만
function FixedOption({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View style={styles.optionRow}>
      <View style={[formStyles.input, styles.optionInput, styles.fixedOption]}>
        <Text style={styles.fixedText}>{label}</Text>
      </View>
      <SmallButton label="✕" onPress={onRemove} />
    </View>
  );
}

function SmallButton({
  label,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable style={[styles.smallButton, disabled && styles.smallDisabled]} onPress={onPress} disabled={disabled} hitSlop={4}>
      <Text style={[styles.smallText, danger && styles.dangerText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.sm,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  cardActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  smallButton: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  smallDisabled: {
    opacity: 0.3,
  },
  smallText: {
    fontSize: fontSize.small,
    color: colors.text,
  },
  dangerText: {
    color: colors.danger,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  optionInput: {
    flex: 1,
  },
  addText: {
    fontSize: fontSize.body,
    color: colors.primary,
    fontWeight: "600",
  },
  addOption: {
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.primaryMuted,
    borderRadius: radius.md,
    alignItems: "center",
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  quickAdd: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  quickText: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  fixedOption: {
    backgroundColor: colors.surfaceMuted,
    justifyContent: "center",
  },
  fixedText: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  addQuestion: {
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
});
