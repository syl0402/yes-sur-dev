// 작성 ③ 대상 · 공개 · 보상 (2026-11-07 보상 연락처 · 2026-11-13 설문 흐름 시안 register/Target:
// 응답 대상 나눔 버튼 · 인원 −/+ 와 빠른 선택 · 등록비 상자(모자라면 빨강 + "n명으로") · 마감 3/7/14일 + 날짜 · 결과 공개 카드 3개)
// 기능은 그대로, 모양만. 경품 칸 나누기는 테스트 후 검토 (지금은 보상 안내 글)
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import CostReceipt from "@/components/create/CostReceipt";
import { formStyles } from "@/components/create/formStyles";
import CheckRow from "@/components/ui/CheckRow";
import Segmented from "@/components/ui/Segmented";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { REWARD_NOTE_MAX, type ResultVisibility, type SurveyDraft, estimate, hasReward } from "@/lib/surveyDraft";

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

// 빠른 선택 인원 · 마감 일수 (화면 버튼일 뿐. 실제 허용 범위는 point_rules 최소·최대로 거른다)
const QUICK_TARGETS = [10, 30, 50, 100];
const DAY_OPTIONS = [3, 7, 14];
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 지금부터 n일 뒤 날짜: "11월 20일 (목)"
function dueLabel(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

export default function SettingsStep({ draft, rules, hasSchool, isOrg, cost, balance, onChange }: Props) {
  const [showCalc, setShowCalc] = useState(false);
  const target = Number(draft.target);
  const minT = rules.survey_min_target;
  const maxT = rules.survey_max_target;
  // 지금 포인트로 받을 수 있는 최대 인원 (1명당 등록비는 설문 길이로 정해진다)
  const { price } = estimate(draft, rules);
  const maxByBalance = price > 0 ? Math.min(Math.floor(balance / price), maxT) : 0;
  const days = Number(draft.days);
  const targetBad = draft.target !== "" && (!Number.isInteger(target) || target < minT || target > maxT);
  const short = !isOrg && !targetBad && draft.target !== "" && cost > balance;

  const setTarget = (n: number) => onChange({ target: String(Math.min(Math.max(n, minT), maxT)) });

  const visibility: { value: ResultVisibility; label: string; desc: string; disabled: boolean }[] = [
    { value: "public", label: "전체 공개", desc: "데이터 허브에 올라가요 · 열람될 때마다 포인트 일부를 받아요", disabled: false },
    { value: "campus", label: "우리 학교만 공개", desc: "우리 학교 학생에게만 결과가 보여요", disabled: !hasSchool },
    // TODO(임시): 단체는 테스트 기간 결과 공개 조건으로 무료 (서버 트리거 org_must_publish) · Q14 답이 오면 변경
    { value: "private", label: "비공개", desc: "나만 볼 수 있어요", disabled: isOrg },
  ];

  return (
    <View style={styles.form}>
      {/* 누가 응답하나요 */}
      <View style={styles.field}>
        <Text style={styles.label}>누가 응답하나요</Text>
        <Segmented
          options={[
            { value: "all", label: "전체 대학생" },
            { value: "campus", label: "우리 학교 학생만", disabled: !hasSchool },
          ]}
          value={draft.audience}
          onChange={(audience) => onChange({ audience })}
        />
        <Text style={styles.hint}>
          {hasSchool
            ? draft.audience === "campus"
              ? "우리 학교 학생에게만 보이고, 설문 카드에 '중앙대생만'처럼 학교 이름으로 표시돼요."
              : "모든 학교 학생에게 보여요."
            : "학교가 없는 계정은 전체 대상만 고를 수 있어요."}
        </Text>
      </View>

      {/* 몇 명 받을까요: −/+ 와 가운데 숫자(눌러서 직접 입력) · 빠른 선택 */}
      <View style={styles.field}>
        <Text style={styles.label}>몇 명 받을까요</Text>
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepButton}
            onPress={() => setTarget((Number.isInteger(target) ? target : minT) - 1)}
            accessibilityLabel="1명 줄이기"
            hitSlop={6}
          >
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <View style={styles.targetWrap}>
            <TextInput
              style={[styles.targetInput, targetBad && styles.targetBad]}
              value={draft.target}
              onChangeText={(t) => onChange({ target: t.replace(/[^0-9]/g, "") })}
              keyboardType="number-pad"
              maxLength={4}
              accessibilityLabel="목표 인원"
            />
            <Text style={styles.targetUnit}>명</Text>
          </View>
          <Pressable
            style={styles.stepButton}
            onPress={() => setTarget((Number.isInteger(target) ? target : minT - 1) + 1)}
            accessibilityLabel="1명 늘리기"
            hitSlop={6}
          >
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>
        <View style={styles.quickRow}>
          {QUICK_TARGETS.filter((n) => n >= minT && n <= maxT).map((n) => {
            const on = target === n;
            return (
              <Pressable key={n} style={[styles.quick, on && styles.quickOn]} onPress={() => setTarget(n)}>
                <Text style={[styles.quickText, on && styles.quickTextOn]}>{n}명</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.hint, styles.center, targetBad && styles.bad]}>
          {minT}~{maxT}명 · 목표 인원이 모이면 자동으로 마감돼요
        </Text>

        {/* 등록비 상자: 모자라면 빨강 + 내 포인트로 가능한 최대 인원 버튼 */}
        {isOrg ? (
          <Text style={styles.hint}>단체 계정은 테스트 기간 동안 등록비가 없어요.</Text>
        ) : (
          !targetBad &&
          draft.target !== "" && (
            <View style={[styles.costBox, short && styles.costBoxShort]}>
              <View style={styles.costTop}>
                <Text style={styles.costLabel}>등록비</Text>
                <Text style={[styles.costValue, short && styles.bad]}>{formatPoints(cost)}</Text>
              </View>
              {short ? (
                <View style={styles.costTop}>
                  <Text style={[styles.costSub, styles.bad]}>
                    내 포인트 {formatPoints(balance)} · {formatPoints(cost - balance)} 모자라요
                  </Text>
                  {maxByBalance >= minT && (
                    <Pressable style={styles.fitButton} onPress={() => setTarget(maxByBalance)}>
                      <Text style={styles.fitText}>{maxByBalance}명으로</Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <Text style={[styles.costSub, styles.right]}>등록 후 내 포인트 {formatPoints(balance - cost)}</Text>
              )}
              <Pressable onPress={() => setShowCalc(!showCalc)} hitSlop={6} style={styles.calcToggle}>
                <Text style={styles.calcText}>{showCalc ? "계산 접기 ▴" : "어떻게 계산됐나요? ›"}</Text>
              </Pressable>
              {showCalc && (
                <>
                  <CostReceipt draft={draft} rules={rules} target={target} balance={balance} />
                  <Pressable onPress={() => router.push("/points")} hitSlop={8}>
                    <Text style={styles.calcText}>등록비는 어떻게 정해지나요? ›</Text>
                  </Pressable>
                </>
              )}
            </View>
          )
        )}
      </View>

      {/* 언제까지 받을까요: 3·7·14일 + 실제 날짜 */}
      <View style={styles.field}>
        <Text style={styles.label}>언제까지 받을까요</Text>
        <View style={styles.dayRow}>
          {DAY_OPTIONS.filter((n) => n <= rules.survey_max_days).map((n) => {
            const on = days === n;
            return (
              <Pressable key={n} style={[styles.day, on && styles.dayOn]} onPress={() => onChange({ days: String(n) })}>
                <Text style={[styles.dayText, on && styles.dayTextOn]}>{n}일</Text>
              </Pressable>
            );
          })}
        </View>
        {Number.isInteger(days) && days >= 1 && (
          <Text style={styles.hint}>{dueLabel(days)} 마감 · 등록한 시각부터 세요</Text>
        )}
      </View>

      {/* 결과를 누구에게 보여줄까요: 설명이 붙은 카드 3개 */}
      <View style={styles.field}>
        <Text style={styles.label}>결과를 누구에게 보여줄까요</Text>
        {visibility.map((v) => {
          const on = draft.resultVisibility === v.value;
          return (
            <Pressable
              key={v.value}
              style={[styles.visCard, on && styles.visCardOn, v.disabled && styles.disabled]}
              onPress={() => onChange({ resultVisibility: v.value })}
              disabled={v.disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, disabled: v.disabled }}
            >
              <View style={[styles.ring, on && styles.ringOn]} />
              <View style={styles.visMain}>
                <Text style={styles.visLabel}>{v.label}</Text>
                <Text style={styles.visDesc}>{v.desc}</Text>
              </View>
            </Pressable>
          );
        })}
        <Text style={styles.hint}>
          {isOrg
            ? "단체는 결과 공개 조건으로 무료예요. 결과는 데이터 허브에서 ✓ 인증 단체로 표시돼요."
            : draft.resultVisibility === "private"
              ? "결과는 나만 봐요. 응답한 사람도 볼 수 없어요."
              : "마감 후 응답이 5개 이상이면 공개돼요. 주관식 답과 개인별 답은 공개되지 않아요."}
        </Text>
      </View>

      {/* 보상 연락처: 기프티콘 등을 줄 때만. 응답자가 동의하고 남긴 휴대폰 번호를 작성자만 본다 */}
      <View style={styles.field}>
        <Text style={styles.label}>
          응답자 보상 <Text style={styles.labelLight}>(선택 · 포인트와 별개로 기프티콘 등)</Text>
        </Text>
        <TextInput
          style={[formStyles.input, formStyles.multiline, styles.box]}
          value={draft.rewardNote ?? ""}
          onChangeText={(rewardNote) => onChange({ rewardNote })}
          placeholder={
            "예) 응답해 주신 분들 중 10분을 추첨해 커피 기프티콘을 드려요. 당첨자는 12월 1일에 문자로 안내해 드릴게요."
          }
          maxLength={REWARD_NOTE_MAX}
          multiline
        />
        {hasReward(draft) ? (
          <>
            <Text style={styles.hint}>
              {(draft.rewardNote ?? "").length} / {REWARD_NOTE_MAX}자 · 응답자가 원하면 응답 후 휴대폰 번호를 남겨요. 번호는
              나만 볼 수 있어요.
            </Text>
            <CheckRow
              label="[필수] 받은 연락처는 보상 지급에만 쓰고, 지급 후 지울게요."
              checked={draft.rewardAgreed === true}
              onPress={() => onChange({ rewardAgreed: !draft.rewardAgreed })}
            />
          </>
        ) : (
          <Text style={styles.hint}>없으면 비워 두면 돼요.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 28,
  },
  field: {
    gap: 10,
  },
  label: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.iconStrong,
  },
  labelLight: {
    fontWeight: "500",
  },
  hint: {
    fontSize: fontSize.small,
    lineHeight: 19,
    color: colors.iconStrong,
  },
  center: {
    textAlign: "center",
  },
  right: {
    textAlign: "right",
  },
  bad: {
    color: colors.danger,
  },
  disabled: {
    opacity: 0.4,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: colors.surfaceMuted,
  },
  stepText: {
    fontSize: 22,
    color: colors.textStrong,
  },
  targetWrap: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  targetInput: {
    minWidth: 80,
    paddingVertical: 0,
    textAlign: "center",
    fontSize: 40,
    fontWeight: "800",
    color: colors.text,
  },
  targetBad: {
    color: colors.danger,
  },
  targetUnit: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  quickRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  quick: {
    height: 34,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  quickOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryFaint,
  },
  quickText: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.textStrong,
  },
  quickTextOn: {
    color: colors.primary,
  },
  costBox: {
    marginTop: spacing.xs,
    gap: spacing.xs,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
  },
  costBoxShort: {
    backgroundColor: colors.dangerSoft,
  },
  costTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  costLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  costValue: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.primary,
  },
  costSub: {
    flexShrink: 1,
    fontSize: fontSize.small,
    color: colors.iconStrong,
  },
  fitButton: {
    height: 34,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  fitText: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  calcToggle: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
  },
  calcText: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.primary,
  },
  dayRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  day: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  dayOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryFaint,
  },
  dayText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textStrong,
  },
  dayTextOn: {
    color: colors.primary,
  },
  visCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  visCardOn: {
    borderWidth: 2,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderColor: colors.primary,
    backgroundColor: colors.primaryFaint,
  },
  ring: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  ringOn: {
    borderWidth: 6,
    borderColor: colors.primary,
  },
  visMain: {
    flex: 1,
    gap: 2,
  },
  visLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  visDesc: {
    fontSize: fontSize.caption,
    color: colors.iconStrong,
  },
  box: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
});
