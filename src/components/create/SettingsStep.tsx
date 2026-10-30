import { Text, TextInput, View } from "react-native";

import Chips from "@/components/create/Chips";
import { formStyles } from "@/components/create/formStyles";
import { formatPoints } from "@/lib/format";
import { type SurveyDraft, VISIBILITY_LABELS, estimate } from "@/lib/surveyDraft";

type Props = {
  draft: SurveyDraft;
  rules: Record<string, number>;
  // 학교가 없는 계정(외부 단체)은 "우리 학교만"을 고를 수 없다
  hasSchool: boolean;
  isOrg: boolean;
  // 등록비 (응답 1명 받는 값 × 목표 인원) · 내 포인트
  cost: number;
  balance: number;
  onChange: (patch: Partial<SurveyDraft>) => void;
};

// 작성 ③ 응답 대상 · 목표 인원 · 마감
export default function SettingsStep({ draft, rules, hasSchool, isOrg, cost, balance, onChange }: Props) {
  const { price } = estimate(draft, rules);
  const target = Number(draft.target);
  const days = Number(draft.days);
  const targetBad =
    draft.target !== "" &&
    (!Number.isInteger(target) || target < rules.survey_min_target || target > rules.survey_max_target);
  const daysBad = draft.days !== "" && (!Number.isInteger(days) || days < 1 || days > rules.survey_max_days);

  return (
    <>
      <View style={formStyles.section}>
        <Text style={formStyles.label}>응답 대상</Text>
        <Chips
          options={[
            { value: "all", label: "전체 대학생" },
            { value: "campus", label: "우리 학교 학생만", disabled: !hasSchool },
          ]}
          selected={draft.audience}
          onSelect={(audience) => onChange({ audience })}
        />
        <Text style={formStyles.hint}>
          {hasSchool ? "대상이 아닌 학생에게는 이 설문이 보이지 않아요." : "학교가 없는 계정은 전체 대상만 고를 수 있어요."}
        </Text>
      </View>

      <View style={formStyles.section}>
        <Text style={formStyles.label}>결과 공개</Text>
        <Chips
          options={[
            { value: "public", label: VISIBILITY_LABELS.public },
            { value: "campus", label: VISIBILITY_LABELS.campus, disabled: !hasSchool },
            // TODO(임시): 단체는 테스트 기간 결과 공개 조건으로 무료 (서버 트리거 org_must_publish) · Q14 답이 오면 변경
            { value: "private", label: VISIBILITY_LABELS.private, disabled: isOrg },
          ]}
          selected={draft.resultVisibility}
          onSelect={(resultVisibility) => onChange({ resultVisibility })}
        />
        <Text style={formStyles.hint}>
          {isOrg
            ? "단체는 결과 공개 조건으로 무료예요. 결과는 데이터 허브에서 ✓ 인증 단체로 표시돼요."
            : draft.resultVisibility === "private"
            ? "결과는 나만 봐요. 응답한 사람도 볼 수 없어요."
            : "마감 후 응답이 5개 이상이면 데이터 허브에 공개돼요. 누가 열람하면 포인트 일부를 받아요. 주관식 답과 개인별 답은 공개되지 않아요."}
        </Text>
      </View>

      <View style={formStyles.section}>
        <Text style={formStyles.label}>목표 인원</Text>
        <TextInput
          style={formStyles.input}
          value={draft.target}
          onChangeText={(t) => onChange({ target: t.replace(/[^0-9]/g, "") })}
          keyboardType="number-pad"
          maxLength={4}
        />
        <Text style={targetBad ? formStyles.error : formStyles.hint}>
          {rules.survey_min_target}~{rules.survey_max_target}명. 목표에 닿으면 자동으로 마감돼요.
        </Text>
        {/* 등록비 바로 계산: 인원을 바꾸면 바로 바뀐다 */}
        {isOrg ? (
          <Text style={formStyles.hint}>단체 계정은 테스트 기간 동안 등록비가 없어요.</Text>
        ) : (
          !targetBad &&
          draft.target !== "" && (
            <Text style={cost > balance ? formStyles.error : formStyles.label}>
              등록비: 응답 1명당 {formatPoints(price)} × {target}명 = {formatPoints(cost)}
              {cost > balance ? ` (내 포인트 ${formatPoints(balance)} · 인원을 줄여 주세요)` : ""}
            </Text>
          )
        )}
      </View>

      <View style={formStyles.section}>
        <Text style={formStyles.label}>마감까지 (일)</Text>
        <TextInput
          style={formStyles.input}
          value={draft.days}
          onChangeText={(t) => onChange({ days: t.replace(/[^0-9]/g, "") })}
          keyboardType="number-pad"
          maxLength={2}
        />
        <Text style={daysBad ? formStyles.error : formStyles.hint}>
          1~{rules.survey_max_days}일. 등록한 때부터 세요.
        </Text>
      </View>
    </>
  );
}
