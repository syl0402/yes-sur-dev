import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import CompositionChart from "@/components/results/CompositionChart";
import GroupCompare, { DimChips, FocusChips } from "@/components/results/GroupCompare";
import InsightCard from "@/components/results/InsightCard";
import QuestionResult, { Bar, QuestionHeader, percent, type QuestionStats } from "@/components/results/QuestionResult";
import Card from "@/components/ui/Card";
import Segmented from "@/components/ui/Segmented";
import SelectButton from "@/components/ui/SelectButton";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { formatPoints, formatShortDate } from "@/lib/format";
import { type CrossResults, type FullResults, GROUP_DIMS, type Group, type GroupDim, sortGroups } from "@/lib/hub";
import { showNotice } from "@/lib/notice";
import { buildInsights, formatSeconds } from "@/lib/resultSummary";
import { fetchRules } from "@/lib/rules";
import { canDrawSvg } from "@/lib/nativeFeatures";
import { supabase } from "@/lib/supabase";

type Tab = "questions" | "people" | "info";
// 나눠 보는 기준: 전체 · 회원정보 그룹 · 다른 문항의 답(교차 분석)
type Dim = "all" | GroupDim | "cross";

// 나눠 보기 선택지
// 2026-11-14 데이터 허브 시안: 칩 한 줄 (전체 · 성별 · 나이대 · 학년 · 계열 · 다른 문항 답별)
const DIM_OPTIONS: { value: Dim; label: string }[] = [
  { value: "all", label: "전체" },
  ...GROUP_DIMS,
  { value: "cross", label: "다른 문항 답별" },
];

// 조사 정보 · 나눠 보기에 쓰는 기준 (point_rules)
const RESULT_RULE_KEYS = ["trust_min_responses", "trust_min_pass_rate", "low_response_warning"];

const TABS: { value: Tab; label: string }[] = [
  { value: "questions", label: "문항별 결과" },
  { value: "people", label: "응답자" },
  { value: "info", label: "조사 정보" },
];

type Props = {
  surveyId: number;
  full: FullResults;
  // 공유 카드에 들어갈 설문 이름
  title: string;
  // 등록자 화면: 주관식 원문이 든 문항 (없으면 full.overall)
  questions?: QuestionStats[];
  // 등록자의 열람 수익 표시 (단체는 포인트를 쓰지 않아 열람 수만)
  showEarnings?: boolean;
};

// 전체 결과 (ys-131 열람 후 · ys-121 등록자): 핵심 인사이트 → 탭 [문항별 결과 | 응답자 | 조사 정보] (2026-11-01 정리, 2026-11-10 나눠 보기·그룹 막대 정리)
// 결과 카드 공유는 아래 고정 바 [공유] → ShareSheet (2026-11-14)
// 출처 복사·집계 CSV는 화면 아래 고정 바(ResultsActionBar)로 (2026-11-07)
export default function ResultsView({ surveyId, full, title, questions = full.overall, showEarnings = true }: Props) {
  const [tab, setTab] = useState<Tab>("questions");
  const [dim, setDim] = useState<Dim>("all");
  // 교차 분석: 기준 문항 · 불러온 결과 (null = 불러오는 중)
  const [crossId, setCrossId] = useState<number | null>(null);
  const [cross, setCross] = useState<CrossResults | null>(null);
  // 신뢰도 기준·소표본 기준 (point_rules) · 응답 대상
  const [rules, setRules] = useState<Record<string, number>>({});
  const [audience, setAudience] = useState<"all" | "campus" | null>(null);

  useEffect(() => {
    fetchRules(RESULT_RULE_KEYS).then(setRules);
    supabase
      .from("surveys")
      .select("audience")
      .eq("id", surveyId)
      .maybeSingle()
      .then(({ data }) => setAudience((data?.audience as "all" | "campus" | undefined) ?? null));
  }, [surveyId]);

  if (full.total === 0) return <Text style={styles.muted}>결과에 반영된 응답이 없어요.</Text>;

  // 기준으로 쓸 수 있는 문항 (하나 고르기·척도)
  const crossable = full.overall.map((q, index) => ({ q, index })).filter(({ q }) => q.type === "single" || q.type === "scale");

  const pickCross = async (questionId: number) => {
    setCrossId(questionId);
    setCross(null);
    const { data, error } = await supabase.rpc("get_cross_results", { p_survey_id: surveyId, p_question_id: questionId });
    if (error) {
      showNotice("나눠 보지 못했어요", errorMessage(error));
      return;
    }
    setCross(data as CrossResults);
  };

  // 신뢰도 높음: 유효 응답 기준 이상 + 확인 문항 통과율 기준 이상 (서버 get_hub_preview와 같은 기준)
  const trusted =
    rules.trust_min_responses !== undefined &&
    full.total >= rules.trust_min_responses &&
    (full.pass_rate === null || full.pass_rate >= (rules.trust_min_pass_rate ?? 1) * 100);
  const insights = buildInsights(full);

  return (
    <>
      <InsightCard insights={insights} />

      <Segmented options={TABS} value={tab} onChange={setTab} />

      {tab === "questions" && (
        <>
          {/* 나눠 보기: 칩 한 줄 (화면 전체 문항에 같이 적용, 이름표 없이 칩만). 다른 문항 답별이면 기준 문항 버튼이 하나 더 */}
          <DimChips options={DIM_OPTIONS.filter((o) => o.value !== "cross" || crossable.length > 0)} value={dim} onChange={setDim} />
          <View style={styles.selects}>
            {dim === "cross" && (
              <SelectButton
                title="어떤 문항의 답별로 나눠 볼까요?"
                options={crossable.map(({ q, index }) => ({
                  value: String(q.id),
                  label: `Q${index + 1} ${q.text.length > 18 ? `${q.text.slice(0, 18)}…` : q.text}`,
                }))}
                value={crossId === null ? "" : String(crossId)}
                onChange={(v) => pickCross(Number(v))}
                defaultValue=""
                placeholder="기준 문항 고르기"
              />
            )}
          </View>
          {dim === "cross" && crossId === null && (
            <Text style={styles.hint}>예: ‘도서관’이라고 답한 사람들끼리 다른 문항은 어떻게 답했는지 볼 수 있어요.</Text>
          )}

          {/* 나눠 보기를 바꾸면 문항 목록이 살짝 나타난다 (0.25초, 2026-11-14 시안) */}
          <Animated.View key={`${dim}-${crossId ?? ""}`} entering={FadeIn.duration(250)} style={styles.list}>
          {dim === "all" && questions.map((q, index) => <QuestionResult key={q.id} index={index} question={q} />)}

          {dim !== "all" &&
            dim !== "cross" &&
            full.overall.map((q, index) => (
              <GroupedQuestion
                key={q.id}
                index={index}
                question={q}
                groups={sortGroups(dim, full.groups[dim])}
                fewUnder={rules.low_response_warning ?? 10}
              />
            ))}

          {dim === "cross" &&
            crossId !== null &&
            (cross === null ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                {full.overall.map((q, index) =>
                  q.id === crossId ? null : (
                    <GroupedQuestion
                      key={q.id}
                      index={index}
                      question={q}
                      groups={cross.groups}
                      fewUnder={rules.low_response_warning ?? 10}
                    />
                  ),
                )}
              </>
            ))}
          </Animated.View>
        </>
      )}

      {/* 응답자 구성: 도넛 (2026-11-13 결정, A안 나눔 막대 대신). 그림 부품이 없는 옛 앱만 나눔 막대 */}
      {tab === "people" && (
        <Animated.View entering={FadeIn.duration(250)}>
          <CompositionChart groups={full.groups} variant={canDrawSvg ? "donut" : "bar"} />
        </Animated.View>
      )}

      {/* 조사 정보: 신뢰도 이유(연두 상자, 기준은 point_rules) + 이름표–값 줄 (2026-11-14 데이터 허브 시안) */}
      {tab === "info" && (
        <Animated.View entering={FadeIn.duration(250)} style={styles.infoWrap}>
          {trusted && (
            <View style={styles.trustBox}>
              <Text style={styles.trustTitle}>✓ 신뢰도 높음인 이유</Text>
              <View>
                <Text style={styles.trustLine}>
                  · 유효 응답 {full.total}명 ({rules.trust_min_responses}명 이상)
                </Text>
                {full.pass_rate !== null && (
                  <Text style={styles.trustLine}>
                    · 확인 문항 통과율 {full.pass_rate}% ({Math.round((rules.trust_min_pass_rate ?? 0) * 100)}% 이상)
                  </Text>
                )}
                {full.excluded > 0 && (
                  <Text style={styles.trustLine}>· 확인 문항을 틀린 응답 {full.excluded}건은 결과에서 뺐어요</Text>
                )}
              </View>
            </View>
          )}
          <View style={styles.infoBox}>
            {[
              { label: "유효 응답", value: `${full.total}명` },
              { label: "확인 문항 통과율", value: full.pass_rate !== null ? `${full.pass_rate}%` : "-" },
              { label: "평균 응답 시간", value: full.avg_seconds !== null ? formatSeconds(full.avg_seconds) : "-" },
              { label: "조사 기간", value: `${formatShortDate(full.started_at)} ~ ${formatShortDate(full.ended_at)}` },
              ...(audience ? [{ label: "대상", value: audience === "campus" ? "우리 학교 학생" : "전체 대학생" }] : []),
              ...(full.share_earned !== null
                ? [
                    {
                      label: "열람",
                      value: `${full.view_count}회${showEarnings ? ` · 수익 +${formatPoints(full.share_earned)}` : ""}`,
                    },
                  ]
                : []),
            ].map((row) => (
              <View key={row.label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            ))}
          </View>
          {!trusted && full.excluded > 0 && (
            <Text style={styles.infoNote}>확인 문항을 틀린 응답 {full.excluded}건은 결과에서 뺐어요.</Text>
          )}
        </Animated.View>
      )}
    </>
  );
}

// 문항 하나를 묶음별로 (회원정보 그룹 또는 교차 분석). 2026-11-14 데이터 허브 시안 Detail:
// - 고르기: 위 보기 칩으로 볼 답을 고르면 "'답'이라고 답한 비율"을 묶음별 가로 막대로, 큰 순서 정렬
//   가장 높은 묶음 진한 파랑·굵게, 가장 낮은 묶음 Blue 300, 나머지 Blue 200. 아래 점선 + 전체 평균
// - 척도: 묶음별 평균 점수를 같은 방식으로
// - 응답이 적은 묶음(point_rules low_response_warning 미만)은 흐리게 + 주의 문구, 5명 미만은 숨김(개인정보)
// - "모든 답 숫자로 보기": 묶음마다 전체 막대 (표처럼 숫자 확인)
function GroupedQuestion({
  index,
  question: q,
  groups,
  fewUnder,
}: {
  index: number;
  question: QuestionStats;
  groups: Group[];
  fewUnder: number;
}) {
  const [open, setOpen] = useState(false);
  const overallTop = [...q.options].sort((a, b) => b.count - a.count)[0];
  const [focusId, setFocusId] = useState<number | null>(overallTop?.id ?? null);
  const shown = groups
    .map((g) => ({ g, s: g.questions.find((x) => x.id === q.id) }))
    .filter((r): r is { g: Group; s: QuestionStats } => !r.g.hidden && !!r.s && r.s.answered > 0);
  const hidden = groups.filter((g) => g.hidden);

  if (q.type === "text") {
    return (
      <Card>
        <QuestionHeader index={index} question={q} />
        <Text style={styles.label}>주관식은 나눠 보기를 하지 않아요.</Text>
      </Card>
    );
  }

  const isScale = q.type === "scale";
  const focus = q.options.find((o) => o.id === focusId) ?? overallTop;

  // 묶음마다 값: 고르기 = 고른 답의 비율(%), 척도 = 평균 점수. 큰 순서
  const rows = shown
    .map(({ g, s }) => ({
      label: g.label,
      n: g.n ?? s.answered,
      value: isScale ? (s.scale?.avg ?? 0) : percent(s.options.find((o) => o.id === focus?.id)?.count ?? 0, s.answered),
    }))
;
  const overall = isScale ? (q.scale?.avg ?? null) : percent(focus?.count ?? 0, q.answered);
  const unit = isScale ? "점" : "%";

  return (
    <Card>
      <QuestionHeader index={index} question={q} />

      {/* 고르기: 볼 답 고르기 */}
      {!open && !isScale && q.options.length > 1 && (
        <FocusChips
          options={q.options.map((o) => ({ value: o.id, label: o.text }))}
          value={focus?.id}
          onChange={setFocusId}
        />
      )}

      {!open && rows.length > 0 && (
        <GroupCompare
          title={
            isScale ? (
              "묶음별 평균 점수"
            ) : (
              <>
                <Text style={styles.compareStrong}>‘{focus?.text}’</Text>라고 답한 비율
              </>
            )
          }
          rows={rows}
          fewUnder={fewUnder}
          overall={overall}
          unit={unit}
          max={isScale ? 5 : 100}
        />
      )}

      {open &&
        shown.map(({ g, s }) => {
          const max = Math.max(0, ...s.options.map((o) => o.count));
          return (
            <View key={g.label} style={styles.group}>
              <Text style={styles.groupTitle}>
                {g.label} <Text style={styles.groupN}>{g.n}명</Text>
              </Text>
              {isScale ? (
                (s.scale?.counts ?? []).map((count, i) => (
                  <Bar key={i} label={`${i + 1}점`} count={count} pct={percent(count, s.answered)} />
                ))
              ) : (
                s.options.map((o) => (
                  <Bar key={o.id} label={o.text} count={o.count} pct={percent(o.count, s.answered)} top={max > 0 && o.count === max} />
                ))
              )}
            </View>
          );
        })}

      {shown.length === 0 && <Text style={styles.label}>보여 줄 수 있는 묶음이 없어요.</Text>}
      {hidden.length > 0 && <Text style={styles.label}>5명 미만이라 숨김: {hidden.map((g) => g.label).join(", ")}</Text>}

      {shown.length > 0 && (
        <Pressable onPress={() => setOpen(!open)} hitSlop={8} style={styles.more}>
          <Text style={styles.moreText}>{open ? "접기 ▴" : isScale ? "점수 분포 보기 ▾" : "모든 답 숫자로 보기 ▾"}</Text>
        </Pressable>
      )}
    </Card>
  );
}


const styles = StyleSheet.create({
  // 조사 정보
  trustBox: {
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
  },
  trustTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  trustLine: {
    fontSize: fontSize.small,
    lineHeight: 20,
    color: colors.textStrong,
  },
  list: {
    gap: spacing.md,
  },
  infoWrap: {
    gap: spacing.sm,
  },
  infoBox: {
    padding: 18,
    gap: 14,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  infoValue: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  infoNote: {
    paddingHorizontal: spacing.xs,
    fontSize: fontSize.caption,
    color: colors.textSubtle,
  },
  label: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  muted: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: "center",
  },
  selects: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  hint: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
  },
  compareStrong: {
    fontWeight: "700",
  },
  group: {
    gap: 6,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  groupTitle: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.text,
  },
  groupN: {
    fontSize: 11,
    fontWeight: "400",
    color: colors.textMuted,
  },
  more: {
    alignSelf: "center",
    paddingTop: spacing.xs,
  },
  moreText: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.primary,
  },
});
