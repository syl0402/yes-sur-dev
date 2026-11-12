import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import Chips from "@/components/create/Chips";
import { formStyles } from "@/components/create/formStyles";
import Chip from "@/components/ui/Chip";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
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

// 작성 ① 제목 · 설명 · 카테고리 · 태그(선택)
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
    <>
      <View style={formStyles.card}>
        <Text style={formStyles.label}>제목</Text>
        <TextInput
          style={formStyles.input}
          value={draft.title}
          onChangeText={(title) => onChange({ title })}
          placeholder="예: 대학생 스터디 습관 조사"
          maxLength={TITLE_MAX}
        />
        {draft.title.length > 0 && titleLength < TITLE_MIN ? (
          <Text style={formStyles.error}>제목은 {TITLE_MIN}자 이상 입력해 주세요.</Text>
        ) : (
          <Text style={formStyles.hint}>
            {titleLength} / {TITLE_MAX}자
          </Text>
        )}
      </View>

      <View style={formStyles.card}>
        <Text style={formStyles.label}>설명 (선택)</Text>
        <TextInput
          style={[formStyles.input, formStyles.multiline]}
          value={draft.description}
          onChangeText={(description) => onChange({ description })}
          placeholder="설문 목적이나 응답자에게 알릴 내용을 적어 주세요."
          maxLength={DESCRIPTION_MAX}
          multiline
        />
        <Text style={formStyles.hint}>
          {draft.description.length} / {DESCRIPTION_MAX}자
        </Text>
      </View>

      <View style={formStyles.card}>
        <Text style={formStyles.label}>카테고리</Text>
        <Chips
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          selected={draft.categoryId}
          onSelect={(categoryId) => {
            onChange({ categoryId });
            onCategoryPicked?.();
          }}
        />
      </View>

      {/* 태그: 카테고리를 고른 뒤에만. 그 카테고리 추천 태그 먼저 + 더보기 (2026-11-12 설문 흐름 시안 register/Main) */}
      {tags.length > 0 && draft.categoryId != null && (
        <View style={formStyles.card}>
          <Text style={formStyles.label}>
            태그 (선택) · {tagIds.length}/{tagMax}
          </Text>
          <View style={styles.tags}>
            {shownTags.map((t) => {
              const selected = tagIds.includes(t.id);
              return (
                <Chip
                  key={t.id}
                  label={formatTag(t.name)}
                  selected={selected}
                  disabled={!selected && tagsFull}
                  onPress={() => toggleTag(t.id)}
                />
              );
            })}
          </View>
          {hasMore && (
            <Pressable onPress={() => setShowAll(!showAll)} hitSlop={8} style={styles.more}>
              <Text style={styles.moreText}>{showAll ? "접기 ▴" : "더보기 ▾"}</Text>
            </Pressable>
          )}
          <Text style={formStyles.hint}>
            설문 주제를 {tagMax}개까지 골라 주세요. 목록에서 태그를 누르면 같은 주제 설문을 모아 볼 수 있어요.
          </Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  more: {
    alignSelf: "flex-start",
  },
  moreText: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.textMuted,
  },
});
