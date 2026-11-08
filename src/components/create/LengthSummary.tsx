// 설문 길이 요약 상자 (작성 ② 문항 · ③ 목표 인원, 2026-11-09 피드백: 내 설문이 몇 분짜리·어느 구간인지 모름)
// 첫 줄 "8문항 · 예상 약 2분 · 3분 이내 구간". 숫자는 서버와 같은 계산(estimate)
// ② 문항: 응답 보상·1명당 등록비 + 다음 구간 경계 알림 / ③ 목표 인원: 1명당 등록비 + 내 포인트로 받을 수 있는 최대 인원
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { BANDS, bandOf } from "@/lib/pointBands";
import { type SurveyDraft, estimate, newQuestion } from "@/lib/surveyDraft";

type Props = {
  draft: SurveyDraft;
  rules: Record<string, number>;
  // 단체는 테스트 기간 등록비가 없다
  isOrg: boolean;
  // questions = ② 문항 화면, target = ③ 목표 인원 (내 포인트를 함께 넘긴다)
  variant: "questions" | "target";
  balance?: number;
};

const bandLabel = (count: number, minutes: number) => BANDS.find((b) => b.key === bandOf(count, minutes))?.label ?? "";

export default function LengthSummary({ draft, rules, isOrg, variant, balance = 0 }: Props) {
  const count = draft.questions.length;
  const { minutes, reward, price } = estimate(draft, rules);
  const label = bandLabel(count, minutes);

  // 1문항은 구간 이름도 "1문항"이라 겹치지 않게
  const main =
    count === 1 ? (
      <>
        <Text style={styles.band}>1문항</Text> 설문 · 예상 약 {minutes}분
      </>
    ) : (
      <>
        {count}문항 · 예상 약 {minutes}분 · <Text style={styles.band}>{label}</Text> 구간
      </>
    );

  let sub: string;
  let hint: string | null = null;
  if (variant === "questions") {
    sub = `응답자 보상 +${formatPoints(reward)}` + (isOrg ? "" : ` · 등록비 1명당 ${formatPoints(price)}`);
    // 고르는 문항을 하나 더 넣으면 구간이 바뀌는지 (2문항 이상일 때만. 1 → 2문항은 당연히 바뀌니 생략)
    const next = estimate({ ...draft, questions: [...draft.questions, newQuestion()] }, rules);
    const nextLabel = bandLabel(count + 1, next.minutes);
    if (count >= 2 && nextLabel !== label) {
      hint = `문항을 1개 더 넣으면 '${nextLabel}' 구간이 돼요` + (isOrg ? "." : ` (등록비 1명당 ${formatPoints(next.price)}).`);
    }
  } else if (isOrg) {
    sub = "단체는 테스트 기간 동안 등록비가 없어요.";
  } else {
    // 몇 명으로 할지 감 잡기: 지금 포인트로 받을 수 있는 최대 인원
    const max = price > 0 ? Math.min(Math.floor(balance / price), rules.survey_max_target) : 0;
    sub =
      `등록비 1명당 ${formatPoints(price)} · ` +
      (max >= rules.survey_min_target
        ? `내 포인트로 최대 ${max}명`
        : `내 포인트로는 최소 조건(${rules.survey_min_target}명)에 모자라요`);
  }

  return (
    <View style={styles.box}>
      <Text style={styles.main}>{main}</Text>
      <Text style={styles.sub}>{sub}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  main: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  band: {
    color: colors.primary,
  },
  sub: {
    fontSize: fontSize.small,
    color: colors.text,
  },
  hint: {
    marginTop: 2,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
});
