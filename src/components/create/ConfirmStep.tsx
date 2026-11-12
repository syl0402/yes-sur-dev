// 작성 ④ 확인하고 등록 (2026-11-02 작성자 표시 · 2026-11-13 설문 흐름 시안 register/Review:
// "응답자에게 이렇게 보여요" 카드 미리보기 · 요약 줄 4개(누르면 그 단계로) · 작성자 표시 나눔 버튼 · 등록비 · 확인 사항 · 등록자 혜택)
import { Pressable, StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import SurveyListCard from "@/components/SurveyListCard";
import Segmented from "@/components/ui/Segmented";
import { Text } from "@/components/ui/Text";
import { uiIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { type SurveyDraft, VISIBILITY_LABELS, estimate, hasReward } from "@/lib/surveyDraft";
import { ANONYMOUS_HOST, type SurveyCard, schoolShort } from "@/lib/surveys";
import type { Tag } from "@/lib/tags";

type Props = {
  draft: SurveyDraft;
  rules: Record<string, number>;
  // 미리보기 카드용: 카테고리 이름 · 고른 태그 · 내 학교 이름
  category: string;
  tags: Tag[];
  schoolName: string;
  // 등록 비용 (단체는 테스트 기간 0)
  cost: number;
  balance: number;
  isOrg: boolean;
  // 단체 이름 (학생은 null)
  orgName: string | null;
  // 학생 닉네임 (작성자 표시 고르기용)
  nickname: string | null;
  onChange: (patch: Partial<SurveyDraft>) => void;
  // 요약 줄을 누르면 그 단계로
  onGoStep: (step: number) => void;
};

export default function ConfirmStep({
  draft,
  rules,
  category,
  tags,
  schoolName,
  cost,
  balance,
  isOrg,
  orgName,
  nickname,
  onChange,
  onGoStep,
}: Props) {
  const { minutes, reward, price } = estimate(draft, rules);
  const hasAttention = draft.questions.length >= rules.attention_min_questions;
  // 다른 사람이 결과를 열람할 때 등록자가 받는 몫 (서버와 같은 계산: 열람료 × 비율, 내림)
  const shareEach = Math.floor(rules.cost_data_view * rules.data_share_rate);
  const target = Number(draft.target);
  const days = Number(draft.days);
  // 설문 탭의 진짜 카드에 넣을 값 (알약·태그·작성자 표시가 실제와 똑같이 보인다)
  const now = new Date();
  const preview: SurveyCard = {
    id: 0,
    title: draft.title.trim(),
    est_minutes: minutes,
    reward_points: reward,
    target_responses: target,
    response_count: 0,
    audience: draft.audience,
    closes_at: new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
    created_at: now.toISOString(),
    category_key: "",
    category_name: category,
    host_name: isOrg ? orgName : draft.showNickname ? nickname : null,
    host_verified: isOrg && orgName !== null,
    tags,
    has_reward: hasReward(draft),
    from_my_school: false,
    campus_label: draft.audience === "campus" ? (schoolName ? `${schoolShort(schoolName)}생만` : "우리 학교 학생만") : "",
    mine: false,
  };

  return (
    <View style={styles.form}>
      {/* 응답자에게 이렇게 보여요: 목록 카드 미리보기 */}
      <View style={styles.previewWrap}>
        <Text style={styles.previewLabel}>응답자에게 이렇게 보여요</Text>
        <SurveyListCard survey={preview} preview />
      </View>

      {/* 요약 줄: 누르면 그 단계로 */}
      <View>
        <SummaryRow
          label="문항"
          value={`${draft.questions.length}문항${hasAttention ? " (+ 확인용 1개)" : ""} · 약 ${minutes}분`}
          onPress={() => onGoStep(2)}
        />
        <SummaryRow
          label="대상"
          value={`${draft.audience === "campus" ? "우리 학교 학생만" : "전체 대학생"} · ${target}명 · ${days}일`}
          onPress={() => onGoStep(3)}
        />
        <SummaryRow label="결과 공개" value={VISIBILITY_LABELS[draft.resultVisibility]} onPress={() => onGoStep(3)} />
        <SummaryRow
          label="보상"
          value={`응답자 +${formatPoints(reward)}${hasReward(draft) ? " · 보상 안내 있음" : ""}`}
          onPress={() => onGoStep(3)}
          last
        />
      </View>

      {/* 작성자 표시 (학생만: 옛썰러 / 닉네임 공개) */}
      {!isOrg && (
        <View style={styles.field}>
          <Text style={styles.label}>작성자 표시</Text>
          <Segmented
            options={[
              { value: "anon", label: `${ANONYMOUS_HOST} (익명)` },
              { value: "nick", label: nickname ? `닉네임 (${nickname})` : "닉네임 공개" },
            ]}
            value={draft.showNickname ? "nick" : "anon"}
            onChange={(v) => onChange({ showNickname: v === "nick" })}
          />
          <Text style={styles.hint}>설문 목록·결과에 보이는 이름이에요. 학교는 보이지 않아요.</Text>
        </View>
      )}

      {/* 등록비 */}
      <View style={styles.costBox}>
        {isOrg ? (
          <CostLine label="등록비" value="없음 (테스트 기간 단체 무료)" />
        ) : (
          <>
            <CostLine label={`등록비 (${formatPoints(price)} × ${target}명)`} value={formatPoints(cost)} strong />
            <CostLine label="등록 후 내 포인트" value={`${formatPoints(balance)} → ${formatPoints(balance - cost)}`} />
          </>
        )}
      </View>

      {/* 등록 전에 확인해 주세요 */}
      <View style={styles.field}>
        <Text style={styles.label}>등록 전에 확인해 주세요</Text>
        <Bullet text="응답자 보상은 소요 시간에 따라 앱이 정하고, 앱이 지급해요." />
        {!isOrg && <Bullet text="일찍 마감하면 못 받은 인원만큼 등록비를 돌려받아요." />}
        {hasAttention && <Bullet text="성실한 응답을 확인하는 문항이 가운데쯤 1개 들어가요. 결과에는 빠져요." />}
        {!isOrg && <Bullet text="소속을 알리고 싶으면 설명에 적어 주세요." />}
        <Bullet
          text="응답이 1명이라도 생기면 제목·문항·인원은 고칠 수 없어요. 응답이 없을 때는 삭제하거나 다시 고칠 수 있어요."
          strong
        />
      </View>

      {/* 등록자만 받는 것 */}
      <View style={styles.benefit}>
        <Text style={styles.benefitTitle}>등록자만 받는 것</Text>
        <Text style={styles.benefitText}>· 원본 CSV(응답 한 명 = 한 줄)와 주관식 답 원문</Text>
        <Text style={styles.benefitText}>
          {isOrg
            ? "· 결과가 데이터 허브에 ✓ 인증 단체로 올라가요. 열람 수는 결과 화면에서 볼 수 있어요."
            : draft.resultVisibility === "private"
              ? "· 결과를 '비공개'로 두면 다른 사람이 열람할 수 없어 열람 수익은 없어요."
              : `· 다른 사람이 결과를 열람할 때마다 ${formatPoints(shareEach)}씩 받아요` +
                (cost > 0 && shareEach > 0 ? ` (${Math.ceil(cost / shareEach)}명만 봐도 등록비 회수)` : "")}
        </Text>
      </View>
    </View>
  );
}

// 요약 한 줄: 이름표 · 값 · › (누르면 그 단계로)
function SummaryRow({ label, value, onPress, last }: { label: string; value: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable style={[styles.summaryRow, !last && styles.summaryLine]} onPress={onPress}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
      <AppIcon name={uiIcons.chevron} size={16} color={colors.textSubtle} />
    </Pressable>
  );
}

function CostLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.costLine}>
      <Text style={styles.costLabel}>{label}</Text>
      <Text style={[styles.costValue, strong && styles.costStrong]}>{value}</Text>
    </View>
  );
}

// 점 + 문장. strong이면 빨간 점 + 굵게 (되돌릴 수 없는 일)
function Bullet({ text, strong }: { text: string; strong?: boolean }) {
  return (
    <View style={styles.bullet}>
      <Text style={[styles.dot, strong && styles.dotStrong]}>·</Text>
      <Text style={[styles.bulletText, strong && styles.bulletStrong]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 24,
  },
  field: {
    gap: 10,
  },
  label: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.iconStrong,
  },
  hint: {
    fontSize: fontSize.small,
    color: colors.iconStrong,
  },
  previewWrap: {
    padding: 14,
    borderRadius: 22,
    backgroundColor: colors.primaryFaint,
  },
  previewLabel: {
    paddingHorizontal: spacing.xs,
    paddingBottom: 10,
    fontSize: fontSize.caption,
    fontWeight: "700",
    color: colors.primaryStrong,
  },
  summaryRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  summaryLine: {
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  summaryLabel: {
    width: 72,
    fontSize: fontSize.label,
    color: colors.iconStrong,
  },
  summaryValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  costBox: {
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
  },
  costLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  costLabel: {
    flexShrink: 1,
    fontSize: fontSize.label,
    color: colors.textStrong,
  },
  costValue: {
    fontSize: fontSize.label,
    color: colors.textStrong,
  },
  costStrong: {
    fontWeight: "700",
    color: colors.text,
  },
  bullet: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  dot: {
    fontSize: fontSize.small,
    fontWeight: "800",
    color: colors.primary,
  },
  dotStrong: {
    color: colors.danger,
  },
  bulletText: {
    flex: 1,
    fontSize: fontSize.small,
    lineHeight: 20,
    color: colors.textStrong,
  },
  bulletStrong: {
    fontWeight: "700",
    color: colors.text,
  },
  benefit: {
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
  },
  benefitTitle: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.text,
  },
  benefitText: {
    fontSize: fontSize.small,
    lineHeight: 20,
    color: colors.textStrong,
  },
});
