import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import Chips from "@/components/create/Chips";
import { formStyles } from "@/components/create/formStyles";
import Chip from "@/components/ui/Chip";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { DESCRIPTION_MAX, type SurveyDraft, TITLE_MAX, TITLE_MIN } from "@/lib/surveyDraft";
import { formatTag, type Tag } from "@/lib/tags";

type Props = {
  draft: SurveyDraft;
  categories: { id: number; name: string }[];
  tags: Tag[];
  // 카테고리 번호 → 추천 태그 번호 (DB category_tag_suggestions, 2026-11-12)
  suggestions: Record<number, number[]>;
  // 태그 최대 개수 (point_rules survey_tag_max)
  tagMax: number;
  onChange: (patch: Partial<SurveyDraft>) => void;
  // 카테고리를 골랐을 때 (화면이 아래 태그 칸으로 내려가게, 2026-11-12)
  onCategoryPicked?: () => void;
};

// 작성 ① 제목 · 설명 · 카테고리 · 태그(선택) (2026-11-12 설문 흐름 시안 register/Main: 카드 없이 칸만 · 태그 테두리 칩)
export default function BasicsStep({ draft, categories, tags, suggestions, tagMax, onChange, onCategoryPicked }: Props) {
  const titleLength = draft.title.trim().length;
  const tagIds = draft.tagIds ?? [];
  const tagsFull = tagIds.length >= tagMax;

  // 태그 켜고 끄기 (최대 개수가 차면 나머지는 흐리게)
  const toggleTag = (id: number) =>
    onChange({ tagIds: tagIds.includes(id) ? tagIds.filter((t) => t !== id) : [...tagIds, id] });

  // 보여 줄 태그: 추천 태그(순서대로) + 이미 고른 태그. 더보기면 나머지 전부
  // 카테고리를 바꿔도 고른 태그는 그대로 둔다. 추천 목록이 없으면(표가 비었으면) 전체를 그대로
  const [showAll, setShowAll] = useState(false);
  const suggestedIds = draft.categoryId != null ? (suggestions[draft.categoryId] ?? []) : [];
  const suggested = suggestedIds
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is Tag => t !== undefined);
  const rest = tags.filter((t) => !suggestedIds.includes(t.id));
  const hasMore = suggested.length > 0 && rest.length > 0;
  const shownTags =
    suggested.length === 0 || showAll ? [...suggested, ...rest] : [...suggested, ...rest.filter((t) => tagIds.includes(t.id))];

  return (
    <View style={styles.form}>
      {/* 제목: 설명과 같은 둥근 상자 (2026-11-12 밑줄 칸은 어색해서 상자로), 글씨만 조금 굵게 */}
      <View style={styles.field}>
        <LabelRow label="제목" length={draft.title.length} max={TITLE_MAX} />
        <TextInput
          style={[formStyles.input, styles.box, styles.titleInput]}
          value={draft.title}
          onChangeText={(title) => onChange({ title })}
          placeholder="예: 시험 기간 카페 이용 설문"
          maxLength={TITLE_MAX}
        />
        {draft.title.length > 0 && titleLength < TITLE_MIN && (
          <Text style={formStyles.error}>제목은 {TITLE_MIN}자 이상 입력해 주세요.</Text>
        )}
      </View>

      <View style={styles.field}>
        <LabelRow label="설명" optional length={draft.description.length} max={DESCRIPTION_MAX} />
        <TextInput
          style={[formStyles.input, formStyles.multiline, styles.box, styles.descInput]}
          value={draft.description}
          onChangeText={(description) => onChange({ description })}
          placeholder="누가, 왜 하는 설문인지 적어 주세요"
          maxLength={DESCRIPTION_MAX}
          multiline
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>카테고리</Text>
        <Chips
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          selected={draft.categoryId}
          onSelect={(categoryId) => {
            onChange({ categoryId });
            onCategoryPicked?.();
          }}
        />
      </View>

      {/* 태그: 카테고리를 고른 뒤에만. 그 카테고리 추천 태그 먼저 + 더보기 (2026-11-12 설문 흐름 시안 register/Main)
          카테고리 칩과 구분되게 테두리 칩 */}
      {tags.length > 0 && draft.categoryId != null && (
        <View style={styles.field}>
          <Text style={styles.label}>
            태그{" "}
            <Text style={styles.labelLight}>
              (선택 · {tagIds.length}/{tagMax})
            </Text>
          </Text>
          <View style={styles.tags}>
            {shownTags.map((t) => {
              const selected = tagIds.includes(t.id);
              return (
                <Chip
                  key={t.id}
                  outline
                  label={formatTag(t.name)}
                  selected={selected}
                  disabled={!selected && tagsFull}
                  onPress={() => toggleTag(t.id)}
                />
              );
            })}
            {hasMore && (
              <Pressable onPress={() => setShowAll(!showAll)} hitSlop={8} style={styles.more}>
                <Text style={styles.moreText}>{showAll ? "접기" : "더보기"}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// 칸 이름표 + (거의 다 찼을 때만) 오른쪽 글자 수 (2026-11-12: 칸마다 글자 수 줄이 있으면 어수선해서)
function LabelRow({ label, optional, length, max }: { label: string; optional?: boolean; length: number; max: number }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>
        {label}
        {optional && <Text style={styles.labelLight}> (선택)</Text>}
      </Text>
      {length >= max * 0.8 && (
        <Text style={formStyles.hint}>
          {length} / {max}자
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  // 카드 상자 없이 칸만 (2026-11-12 시안)
  form: {
    gap: 20,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.iconStrong,
  },
  labelLight: {
    fontWeight: "500",
  },
  descInput: {
    minHeight: 84,
  },
  titleInput: {
    fontSize: fontSize.body,
    fontWeight: "600",
  },
  box: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  more: {
    paddingHorizontal: 6,
    paddingVertical: spacing.sm,
  },
  moreText: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.primary,
  },
});
