import { StyleSheet, View } from "react-native";

import { formStyles } from "@/components/create/formStyles";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, shadow, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { type SurveyDraft, VISIBILITY_LABELS, estimate } from "@/lib/surveyDraft";
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
  const { minutes, reward, price } = estimate(draft, rules);
  const hostLabel = formatHost({ host_name: orgName, host_verified: orgName !== null });
  const hasAttention = draft.questions.length >= rules.attention_min_questions;
  // 다른 사람이 결과를 열람할 때 등록자가 받는 몫 (서버와 같은 계산: 열람료 × 비율, 내림)
  const shareEach = Math.floor(rules.cost_data_view * rules.data_share_rate);

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
        <Row label="결과 공개" value={VISIBILITY_LABELS[draft.resultVisibility]} />
        <Row label="목표 인원" value={`${Number(draft.target)}명`} />
        <Row label="마감" value={`등록 후 ${Number(draft.days)}일`} />
      </View>

      <View style={styles.box}>
        {!isOrg && (
          <Row label="등록비 계산" value={`${formatPoints(price)} × ${Number(draft.target)}명`} />
        )}
        <Row label="등록비" value={formatPoints(cost)} highlight />
        {!isOrg && <Row label="등록 후 내 포인트" value={formatPoints(balance - cost)} />}
      </View>

      <Text style={formStyles.hint}>
        · 응답자 보상은 소요시간에 따라 앱이 정하고, 응답자에게 앱이 지급해요.{"\n"}
        {isOrg ? "" : "· 일찍 마감하면 못 받은 인원만큼 등록비를 돌려받아요.\n"}
        {hasAttention ? "· 성실한 응답을 확인하는 문항이 가운데쯤 1개 들어가요. 결과에는 빠져요.\n" : ""}
        {isOrg ? "" : "· 개인 설문은 작성자가 '개인'으로만 보여요. 소속을 알리고 싶으면 설명에 적어 주세요.\n"}
        · 등록한 뒤에는 내용을 고칠 수 없어요.
      </Text>

      {/* 등록자 혜택 */}
      <View style={styles.box}>
        <Text style={styles.benefitTitle}>등록자만 받는 것</Text>
        <Text style={formStyles.hint}>
          · 원본 CSV (응답 한 명 = 한 줄)와 주관식 답 원문{"\n"}
          {isOrg
            ? "· 결과가 데이터 허브에 ✓ 인증 단체로 올라가요. 열람 수는 결과 화면에서 볼 수 있어요."
            : draft.resultVisibility === "private"
              ? "· 결과를 '나만 보기'로 두면 다른 사람이 열람할 수 없어 열람 수익은 없어요."
              : `· 다른 사람이 결과를 열람할 때마다 ${formatPoints(shareEach)}씩 받아요.` +
                (cost > 0 && shareEach > 0
                  ? `\n· 예: 등록비 ${formatPoints(cost)}는 ${Math.ceil(cost / shareEach)}명이 열람하면 돌려받아요.`
                  : "")}
        </Text>
      </View>
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
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.sm,
    ...shadow.card,
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
  benefitTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  rowHighlight: {
    color: colors.primary,
  },
});
