import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import Chips from "@/components/create/Chips";
import { formStyles } from "@/components/create/formStyles";
import CostReceipt from "@/components/create/CostReceipt";
import CheckRow from "@/components/ui/CheckRow";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { REWARD_NOTE_MAX, type SurveyDraft, VISIBILITY_LABELS, estimate, hasReward } from "@/lib/surveyDraft";

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

// 작성 ③ 응답 대상 · 목표 인원 · 마감 · 보상 연락처(선택, 2026-11-07)
export default function SettingsStep({ draft, rules, hasSchool, isOrg, cost, balance, onChange }: Props) {
  const target = Number(draft.target);
  // 지금 포인트로 받을 수 있는 최대 인원 (1명당 등록비는 설문 길이로 정해진다)
  const { price } = estimate(draft, rules);
  const maxByBalance = price > 0 ? Math.min(Math.floor(balance / price), rules.survey_max_target) : 0;
  const days = Number(draft.days);
  const targetBad =
    draft.target !== "" &&
    (!Number.isInteger(target) || target < rules.survey_min_target || target > rules.survey_max_target);
  const daysBad = draft.days !== "" && (!Number.isInteger(days) || days < 1 || days > rules.survey_max_days);

  return (
    <>
      <View style={formStyles.card}>
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

      <View style={formStyles.card}>
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
            : "마감 후 응답이 5개 이상이면 데이터 허브에 공개돼요. 누군가 열람하면 포인트 일부를 받아요. 주관식 답과 개인별 답은 공개되지 않아요."}
        </Text>
      </View>

      <View style={formStyles.card}>
        <Text style={formStyles.label}>목표 인원</Text>
        <TextInput
          style={formStyles.input}
          value={draft.target}
          onChangeText={(t) => onChange({ target: t.replace(/[^0-9]/g, "") })}
          keyboardType="number-pad"
          maxLength={4}
        />
        <Text style={targetBad ? formStyles.error : formStyles.hint}>
          {rules.survey_min_target}~{rules.survey_max_target}명 · 목표에 닿으면 자동으로 마감돼요
        </Text>
        {isOrg ? (
          <Text style={formStyles.hint}>단체 계정은 테스트 기간 동안 등록비가 없어요.</Text>
        ) : (
          <>
            {/* 몇 명으로 할지 감 잡기: 지금 포인트로 받을 수 있는 최대 인원 (2026-11-09) */}
            <Text style={formStyles.hint}>
              {maxByBalance >= rules.survey_min_target
                ? `내 포인트(${formatPoints(balance)})로 최대 ${maxByBalance}명까지 받을 수 있어요`
                : `내 포인트(${formatPoints(balance)})로는 최소 조건(${rules.survey_min_target}명)에 모자라요`}
            </Text>
            {/* 등록비 계산표: 인원을 바꾸면 바로 바뀐다 */}
            {!targetBad && draft.target !== "" && (
              <CostReceipt draft={draft} rules={rules} target={target} balance={balance} />
            )}
          </>
        )}
        {/* 1명당 값이 설문 길이로 정해지는 걸 알려 준다 (포인트 안내 화면의 구간표) */}
        {!isOrg && (
          <Pressable onPress={() => router.push("/points")} hitSlop={8}>
            <Text style={styles.ruleLink}>등록비는 어떻게 정해지나요? ›</Text>
          </Pressable>
        )}
      </View>

      <View style={formStyles.card}>
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

      {/* 보상 연락처: 기프티콘 등을 줄 때만. 응답자가 동의하고 남긴 휴대폰 번호를 작성자만 본다 */}
      <View style={formStyles.card}>
        <Text style={formStyles.label}>응답자 보상 (선택)</Text>
        <Text style={formStyles.hint}>기프티콘 등 보상을 준다면 안내를 적어 주세요. 없으면 비워 두면 돼요.</Text>
        <TextInput
          style={[formStyles.input, formStyles.multiline]}
          value={draft.rewardNote ?? ""}
          onChangeText={(rewardNote) => onChange({ rewardNote })}
          placeholder={
            "예) 응답해 주신 분들 중 10분을 추첨해 스타벅스 아메리카노 기프티콘을 드려요. 당첨자는 12월 1일에 문자로 개별 안내해 드릴게요."
          }
          maxLength={REWARD_NOTE_MAX}
          multiline
        />
        {hasReward(draft) && (
          <>
            <Text style={formStyles.hint}>
              {(draft.rewardNote ?? "").length} / {REWARD_NOTE_MAX}자 · 응답자가 원하면 휴대폰 번호를 남겨요. 번호는 나만 볼
              수 있어요.
            </Text>
            <CheckRow
              label="[필수] 받은 연락처는 보상 지급에만 쓰고, 지급 후 지울게요."
              checked={draft.rewardAgreed === true}
              onPress={() => onChange({ rewardAgreed: !draft.rewardAgreed })}
            />
          </>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  ruleLink: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    textDecorationLine: "underline",
  },
});
