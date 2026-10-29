import { StyleSheet, Text, View } from "react-native";

import { formStyles } from "@/components/create/formStyles";
import { colors, fontSize, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { type SurveyDraft, estimate } from "@/lib/surveyDraft";
import { formatHost } from "@/lib/surveys";

type Props = {
  draft: SurveyDraft;
  rules: Record<string, number>;
  categoryName: string;
  // 등록 비용 (단체는 테스트 기간 0)
  cost: number;
  balance: number;
  isOrg: boolean;
  // 단체 이름 (학생은 null → "개인")
  orgName: string | null;
};

// 작성 ④ 등록 전 요약
export default function ConfirmStep({ draft, rules, categoryName, cost, balance, isOrg, orgName }: Props) {
  const { minutes, reward } = estimate(draft, rules);
  const hostLabel = formatHost({ host_name: orgName, host_verified: orgName !== null });
  const hasAttention = draft.questions.length >= rules.attention_min_questions;

  return (
    <>
      <Text style={styles.title}>{draft.title.trim()}</Text>
      <Text style={formStyles.hint}>{categoryName}</Text>

      <View style={styles.box}>
        <Row label="작성자로 표시" value={hostLabel} />
        <Row label="문항" value={`${draft.questions.length}개${hasAttention ? " (+ 확인용 1개)" : ""}`} />
        <Row label="예상 소요시간" value={`약 ${minutes}분`} />
        <Row label="응답자 보상" value={`1명당 ${formatPoints(reward)}`} />
        <Row label="응답 대상" value={draft.audience === "campus" ? "우리 학교 학생만" : "전체 대학생"} />
        <Row label="목표 인원" value={`${Number(draft.target)}명`} />
        <Row label="마감" value={`등록 후 ${Number(draft.days)}일`} />
      </View>

      <View style={styles.box}>
        <Row label="등록 비용" value={formatPoints(cost)} highlight />
        {!isOrg && <Row label="등록 후 내 포인트" value={formatPoints(balance - cost)} />}
      </View>

      <Text style={formStyles.hint}>
        · 응답자 보상은 소요시간에 따라 앱이 정하고, 응답자에게 앱이 지급해요.{"\n"}
        {hasAttention ? "· 성실한 응답을 확인하는 문항이 가운데쯤 1개 들어가요. 결과에는 빠져요.\n" : ""}
        {isOrg ? "" : "· 개인 설문은 작성자가 '개인'으로만 보여요. 소속을 알리고 싶으면 설명에 적어 주세요.\n"}
        · 등록한 뒤에는 내용을 고칠 수 없어요.
      </Text>
    </>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight && styles.rowHighlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
  },
  box: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rowLabel: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  rowValue: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.text,
  },
  rowHighlight: {
    color: colors.primary,
  },
});
