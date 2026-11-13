// 설문 길이 요약 줄 (작성 ② 문항 화면 맨 아래, 다음 버튼 바로 위)
// 2026-11-09 피드백(내 설문이 몇 분짜리·어느 구간인지 모름) → 2026-11-14 시안 register/Questions:
// 위 상자와 아래 줄이 겹쳐서 하나로 합침. 스크롤해도 늘 보이게 버튼 위 연파랑 알약
// 첫 줄 "3문항 · 약 1분 · 1명당 15P" (숫자는 서버와 같은 계산 estimate) / 둘째 줄: 다음 구간 경계 알림 (있을 때만)
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
};

const bandLabel = (count: number, minutes: number) => BANDS.find((b) => b.key === bandOf(count, minutes))?.label ?? "";

export default function LengthSummary({ draft, rules, isOrg }: Props) {
  const count = draft.questions.length;
  const { minutes, price } = estimate(draft, rules);
  const label = bandLabel(count, minutes);

  // 고르는 문항을 하나 더 넣으면 구간이 바뀌는지 (2문항 이상일 때만. 1 → 2문항은 당연히 바뀌니 생략)
  const next = estimate({ ...draft, questions: [...draft.questions, newQuestion()] }, rules);
  const nextLabel = bandLabel(count + 1, next.minutes);
  const hint =
    count >= 2 && nextLabel !== label
      ? `1문항 더 넣으면 '${nextLabel}' 구간이 돼요` + (isOrg ? "" : ` (1명당 ${formatPoints(next.price)})`)
      : null;

  return (
    <View style={styles.box}>
      <Text style={styles.main}>
        <Text style={styles.strong}>{count}문항</Text> · 약 {minutes}분
        {isOrg ? null : (
          <>
            {" "}
            · 1명당 <Text style={styles.strong}>{formatPoints(price)}</Text>
          </>
        )}
      </Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignSelf: "center",
    alignItems: "center",
    gap: 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryFaint,
  },
  main: {
    fontSize: fontSize.label,
    color: colors.textStrong,
  },
  strong: {
    fontWeight: "800",
    color: colors.primary,
  },
  hint: {
    fontSize: fontSize.caption,
    color: colors.iconStrong,
  },
});
