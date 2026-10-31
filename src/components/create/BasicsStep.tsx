import { View } from "react-native";

import Chips from "@/components/create/Chips";
import { formStyles } from "@/components/create/formStyles";
import { Text, TextInput } from "@/components/ui/Text";
import { DESCRIPTION_MAX, type SurveyDraft, TITLE_MAX, TITLE_MIN } from "@/lib/surveyDraft";

type Props = {
  draft: SurveyDraft;
  categories: { id: number; name: string }[];
  onChange: (patch: Partial<SurveyDraft>) => void;
};

// 작성 ① 제목 · 설명 · 카테고리
export default function BasicsStep({ draft, categories, onChange }: Props) {
  const titleLength = draft.title.trim().length;

  return (
    <>
      <View style={formStyles.section}>
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

      <View style={formStyles.section}>
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

      <View style={formStyles.section}>
        <Text style={formStyles.label}>카테고리</Text>
        <Chips
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          selected={draft.categoryId}
          onSelect={(categoryId) => onChange({ categoryId })}
        />
      </View>
    </>
  );
}
