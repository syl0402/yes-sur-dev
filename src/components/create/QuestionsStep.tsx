// 작성 ② 문항 (2026-11-10 선택 주관식·해당 없음·기타·보기 섞기
// · 2026-11-13 설문 흐름 시안 register/Questions: 편집 중인 문항만 펼치고 나머지는 한 줄 요약 · 답변 방식은 아래 창 ·
//   위/아래/복제/삭제 아이콘 · 보기 섞기는 "옵션 더보기" 안). 기능은 그대로, 모양만
import { useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import { formStyles } from "@/components/create/formStyles";
import BottomSheet from "@/components/ui/BottomSheet";
import { Text, TextInput } from "@/components/ui/Text";
import { questionIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import {
  type DraftQuestion,
  NONE_OPTION_LABEL,
  OPTION_TEXT_MAX,
  OTHER_OPTION_LABEL,
  QUESTION_TEXT_MAX,
  type QuestionType,
  SCALE_LABELS,
  type SurveyDraft,
  isChoice,
  makeRequestId,
  newQuestion,
  questionTypeLabel,
} from "@/lib/surveyDraft";

type Props = {
  draft: SurveyDraft;
  rules: Record<string, number>;
  onChange: (patch: Partial<SurveyDraft>) => void;
};

// 답변 방식 고르기 창 (2026-11-14 짧은·긴 주관식 나눔. 순위·사진은 테스트 후 검토)
// 주관식은 type text + long(짧은 false · 긴 true)
type TypeChoice = { key: string; type: QuestionType; long?: boolean; label: string; desc: string; icon: keyof typeof questionIcons };
const TYPE_CHOICES: TypeChoice[] = [
  { key: "single", type: "single", label: "하나 고르기", desc: "보기 중 하나만 골라요", icon: "single" },
  { key: "multi", type: "multi", label: "여러 개 고르기", desc: "해당하는 것을 모두 골라요", icon: "multi" },
  { key: "scale", type: "scale", label: "5점 척도", desc: "1~5점 중에서 골라요", icon: "scale" },
  { key: "short", type: "text", long: false, label: "짧은 주관식", desc: "한 줄로 짧게 써요", icon: "shortText" },
  { key: "long", type: "text", long: true, label: "긴 주관식", desc: "여러 줄로 자유롭게 써요", icon: "text" },
];

export default function QuestionsStep({ draft, rules, onChange }: Props) {
  const questions = draft.questions;
  const maxQuestions = rules.survey_max_questions;
  // 펼친 문항 (key). 없으면 첫 문항
  const [openKey, setOpenKey] = useState<string | null>(questions[0]?.key ?? null);
  // 답변 방식 창을 연 문항 번호
  const [typeSheetFor, setTypeSheetFor] = useState<number | null>(null);
  // 옵션 더보기를 연 문항 (key)
  const [moreKey, setMoreKey] = useState<string | null>(null);

  const setQuestions = (next: DraftQuestion[]) => onChange({ questions: next });
  const update = (index: number, patch: Partial<DraftQuestion>) =>
    setQuestions(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));

  const move = (index: number, delta: number) => {
    const next = [...questions];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setQuestions(next);
  };

  const remove = (index: number) => {
    const next = questions.filter((_, i) => i !== index);
    setQuestions(next);
    // 지운 문항이 펼쳐져 있었으면 그 자리(없으면 앞) 문항을 펼친다
    setOpenKey(next[Math.min(index, next.length - 1)]?.key ?? null);
  };

  // 복제: 바로 아래에 같은 내용으로 (새 번호) → 복제본을 펼친다
  const duplicate = (index: number) => {
    const copy = { ...questions[index], key: makeRequestId(), options: [...questions[index].options] };
    const next = [...questions];
    next.splice(index + 1, 0, copy);
    setQuestions(next);
    setOpenKey(copy.key);
  };

  const add = () => {
    const q = newQuestion();
    setQuestions([...questions, q]);
    setOpenKey(q.key);
  };

  // 고르기 문항으로 바꿀 때 보기가 2개보다 적으면 빈 칸을 채워 둔다
  const changeType = (index: number, c: TypeChoice) => {
    const q = questions[index];
    const options = isChoice(c.type) && q.options.length < 2 ? ["", ""] : q.options;
    update(index, { type: c.type, options, long: c.type === "text" ? c.long : undefined });
  };

  const full = questions.length >= maxQuestions;
  const openIndex = Math.max(
    0,
    questions.findIndex((q) => q.key === openKey),
  );

  return (
    <>
      <Text style={styles.guide}>
        문항이 {rules.attention_min_questions}개 이상이면 성실한 응답인지 확인하는 문항이 자동으로 1개 들어가요. 최대{" "}
        {maxQuestions}문항.
      </Text>

      {questions.map((q, index) =>
        index !== openIndex ? (
          // 접힌 문항: 한 줄 요약 (누르면 펼침)
          <Pressable key={q.key} style={styles.summary} onPress={() => setOpenKey(q.key)}>
            <Text style={styles.qNumber}>Q{index + 1}</Text>
            <View style={styles.summaryMain}>
              <Text style={[styles.summaryTitle, !q.text.trim() && styles.summaryEmpty]} numberOfLines={1}>
                {q.text.trim() || "질문을 아직 안 썼어요"}
              </Text>
              <Text style={styles.summaryType}>
                {questionTypeLabel(q)}
                {q.required === false ? " · 선택" : ""}
              </Text>
            </View>
          </Pressable>
        ) : (
          // 펼친 문항: 파란 테두리
          <View key={q.key} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.qNumber}>Q{index + 1}</Text>
              <Pressable style={styles.typeChip} onPress={() => setTypeSheetFor(index)} hitSlop={4}>
                <Text style={styles.typeChipText}>{questionTypeLabel(q)}</Text>
                <AppIcon name={questionIcons.caret} size={14} color={colors.textStrong} />
              </Pressable>
              <View style={styles.spacer} />
              <IconButton icon={questionIcons.up} label="위로 옮기기" onPress={() => move(index, -1)} disabled={index === 0} />
              <IconButton
                icon={questionIcons.down}
                label="아래로 옮기기"
                onPress={() => move(index, 1)}
                disabled={index === questions.length - 1}
              />
              <IconButton icon={questionIcons.copy} label="문항 복제" onPress={() => duplicate(index)} disabled={full} />
              <IconButton
                icon={questionIcons.remove}
                label="문항 삭제"
                onPress={() => remove(index)}
                disabled={questions.length === 1}
                danger
              />
            </View>

            <TextInput
              style={[formStyles.input, styles.questionInput]}
              value={q.text}
              onChangeText={(text) => update(index, { text })}
              placeholder="질문을 입력해 주세요"
              maxLength={QUESTION_TEXT_MAX}
              multiline
            />

            {isChoice(q.type) && (
              <View style={styles.options}>
                {q.options.map((option, oi) => (
                  <View key={oi} style={styles.optionRow}>
                    <View style={[styles.mark, q.type === "multi" && styles.markSquare]} />
                    <TextInput
                      style={styles.optionInput}
                      value={option}
                      onChangeText={(text) => update(index, { options: q.options.map((o, j) => (j === oi ? text : o)) })}
                      placeholder={`보기 ${oi + 1}`}
                      maxLength={OPTION_TEXT_MAX}
                    />
                    {q.options.length > 2 && (
                      <Pressable
                        onPress={() => update(index, { options: q.options.filter((_, j) => j !== oi) })}
                        hitSlop={8}
                        accessibilityLabel="보기 빼기"
                      >
                        <Text style={styles.removeX}>✕</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
                {/* 해당 없음·기타: 문구 고정, 항상 맨 아래 (2026-11-10) */}
                {q.none && <FixedOption label={NONE_OPTION_LABEL} multi={q.type === "multi"} onRemove={() => update(index, { none: false })} />}
                {q.other && <FixedOption label={OTHER_OPTION_LABEL} multi={q.type === "multi"} onRemove={() => update(index, { other: false })} />}
                {q.options.length < rules.survey_max_options && (
                  <Pressable style={styles.addOption} onPress={() => update(index, { options: [...q.options, ""] })} hitSlop={4}>
                    <Text style={styles.addOptionText}>+ 보기 추가</Text>
                  </Pressable>
                )}
                {(!q.none || !q.other) && (
                  <View style={styles.quickRow}>
                    {!q.none && <QuickAdd label="+ 해당 없음" onPress={() => update(index, { none: true })} />}
                    {!q.other && <QuickAdd label="+ 기타 (직접 입력)" onPress={() => update(index, { other: true })} />}
                  </View>
                )}
              </View>
            )}

            {/* 척도·주관식: 응답자에게 보일 모양 미리보기 */}
            {q.type === "scale" && (
              <View style={styles.preview}>
                <View style={styles.scaleRow}>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <View key={v} style={styles.scaleCell}>
                      <Text style={styles.scaleText}>{v}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.scaleLabels}>
                  <Text style={formStyles.hint}>{SCALE_LABELS[0]}</Text>
                  <Text style={formStyles.hint}>{SCALE_LABELS[4]}</Text>
                </View>
              </View>
            )}
            {q.type === "text" && (
              <View style={styles.textPreview}>
                <Text style={styles.textPreviewText}>
                  {q.long === false ? "한 줄로" : "여러 줄로"} 직접 써요 (최대 {rules.answer_text_max}자) · 답은 등록자만 볼 수
                  있어요
                </Text>
              </View>
            )}

            {/* 아래 줄: 옵션 더보기(고르기 문항: 보기 순서 섞기) · 필수 스위치(모든 문항, 2026-11-14) */}
            <View style={styles.footer}>
              {isChoice(q.type) ? (
                <Pressable onPress={() => setMoreKey(moreKey === q.key ? null : q.key)} hitSlop={8}>
                  <Text style={styles.moreText}>{moreKey === q.key ? "옵션 접기 ▴" : "옵션 더보기 ▾"}</Text>
                </Pressable>
              ) : (
                <View />
              )}
              <View style={styles.requiredRow}>
                <Text style={styles.requiredText}>필수</Text>
                <Switch
                  value={q.required !== false}
                  onValueChange={(on) => update(index, { required: on })}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor={colors.surface}
                />
              </View>
            </View>
            {isChoice(q.type) && moreKey === q.key && (
              <View style={styles.moreBox}>
                <View style={styles.requiredRow}>
                  <Text style={styles.moreLabel}>보기 순서 섞기</Text>
                  <Switch
                    value={q.shuffle === true}
                    onValueChange={(on) => update(index, { shuffle: on })}
                    trackColor={{ true: colors.primary, false: colors.border }}
                    thumbColor={colors.surface}
                  />
                </View>
                <Text style={formStyles.hint}>응답자마다 보기 순서가 달라요. 해당 없음·기타는 늘 맨 아래예요.</Text>
              </View>
            )}
            {q.required === false && (
              <Text style={formStyles.hint}>응답자가 비워 두고 넘어갈 수 있어요. 이 문항 결과는 답한 사람만으로 계산해요.</Text>
            )}
          </View>
        ),
      )}

      {!full && (
        <Pressable style={styles.addQuestion} onPress={add}>
          <Text style={styles.addQuestionText}>+ 문항 추가</Text>
        </Pressable>
      )}

      {/* 답변 방식 고르기 (공용 아래 창) */}
      {typeSheetFor !== null && questions[typeSheetFor] && (
        <BottomSheet onClose={() => setTypeSheetFor(null)}>
          <Text style={styles.sheetTitle}>답변 방식</Text>
          {TYPE_CHOICES.map((c) => {
            const cur = questions[typeSheetFor];
            const on = cur.type === c.type && (c.type !== "text" || (cur.long !== false) === c.long);
            return (
              <Pressable
                key={c.key}
                style={[styles.typeRow, on && styles.typeRowOn]}
                onPress={() => {
                  changeType(typeSheetFor, c);
                  setTypeSheetFor(null);
                }}
              >
                <View style={styles.typeIcon}>
                  <AppIcon name={questionIcons[c.icon]} size={20} color={colors.primaryStrong} />
                </View>
                <View style={styles.typeMain}>
                  <Text style={styles.typeLabel}>{c.label}</Text>
                  <Text style={styles.typeDesc}>{c.desc}</Text>
                </View>
              </Pressable>
            );
          })}
        </BottomSheet>
      )}
    </>
  );
}

// 위/아래/복제/삭제 아이콘 버튼 (36×36)
function IconButton({
  icon,
  label,
  onPress,
  disabled,
  danger,
}: {
  icon: (typeof questionIcons)[keyof typeof questionIcons];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={[styles.iconButton, danger && styles.iconButtonDanger, disabled && styles.iconDisabled]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityLabel={label}
    >
      <AppIcon name={icon} size={18} color={danger ? colors.danger : colors.iconStrong} />
    </Pressable>
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
function FixedOption({ label, multi, onRemove }: { label: string; multi: boolean; onRemove: () => void }) {
  return (
    <View style={styles.optionRow}>
      <View style={[styles.mark, multi && styles.markSquare]} />
      <Text style={[styles.optionInput, styles.fixedText]}>{label}</Text>
      <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel="보기 빼기">
        <Text style={styles.removeX}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  guide: {
    fontSize: fontSize.small,
    lineHeight: 20,
    color: colors.iconStrong,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  qNumber: {
    minWidth: 24,
    fontSize: fontSize.label,
    fontWeight: "800",
    color: colors.primary,
  },
  summaryMain: {
    flex: 1,
    gap: 3,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  summaryEmpty: {
    color: colors.textSubtle,
  },
  summaryType: {
    fontSize: fontSize.caption,
    color: colors.iconStrong,
  },
  card: {
    gap: 14,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  typeChipText: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.textStrong,
  },
  spacer: {
    flex: 1,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  iconButtonDanger: {
    borderColor: colors.dangerSoft,
  },
  iconDisabled: {
    opacity: 0.35,
  },
  questionInput: {
    borderRadius: radius.lg,
    fontSize: fontSize.body,
    fontWeight: "600",
  },
  options: {
    gap: spacing.xs,
  },
  optionRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mark: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: 9,
  },
  markSquare: {
    borderRadius: 5,
  },
  optionInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    fontSize: 15,
    color: colors.text,
  },
  fixedText: {
    color: colors.textMuted,
  },
  removeX: {
    paddingHorizontal: spacing.xs,
    fontSize: fontSize.body,
    color: colors.textSubtle,
  },
  addOption: {
    alignSelf: "flex-start",
    paddingVertical: 12,
    paddingLeft: 28,
  },
  addOptionText: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.primary,
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingLeft: 28,
  },
  quickAdd: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  quickText: {
    fontSize: fontSize.small,
    color: colors.textStrong,
  },
  preview: {
    gap: spacing.sm,
  },
  scaleRow: {
    flexDirection: "row",
    gap: 6,
  },
  scaleCell: {
    flex: 1,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },
  scaleText: {
    fontWeight: "700",
    color: colors.text,
  },
  scaleLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  textPreview: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
  },
  textPreviewText: {
    fontSize: fontSize.small,
    color: colors.iconStrong,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  moreText: {
    fontSize: fontSize.small,
    color: colors.iconStrong,
  },
  requiredRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  requiredText: {
    fontSize: fontSize.small,
    color: colors.textStrong,
  },
  moreBox: {
    gap: spacing.xs,
  },
  moreLabel: {
    fontSize: fontSize.label,
    color: colors.text,
  },
  addQuestion: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  addQuestionText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
  },
  sheetTitle: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: fontSize.subtitle,
    fontWeight: "800",
    color: colors.text,
  },
  typeRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  typeRowOn: {
    backgroundColor: colors.primaryFaint,
  },
  typeIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
  },
  typeMain: {
    flex: 1,
    gap: 2,
  },
  typeLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  typeDesc: {
    fontSize: fontSize.caption,
    color: colors.iconStrong,
  },
});
