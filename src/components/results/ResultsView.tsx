import * as Sharing from "expo-sharing";
import { type ComponentRef, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { captureRef } from "react-native-view-shot";

import CompositionChart from "@/components/results/CompositionChart";
import InsightCard from "@/components/results/InsightCard";
import QuestionResult, { Bar, QuestionHeader, percent, type QuestionStats } from "@/components/results/QuestionResult";
import ShareCard, { type ShareHero } from "@/components/results/ShareCard";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Segmented from "@/components/ui/Segmented";
import SelectButton from "@/components/ui/SelectButton";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatPoints, formatShortDate } from "@/lib/format";
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
// 출처 복사·집계 CSV는 화면 아래 고정 바(ResultsActionBar)로 (2026-11-07)
export default function ResultsView({ surveyId, full, title, questions = full.overall, showEarnings = true }: Props) {
  const [tab, setTab] = useState<Tab>("questions");
  const [dim, setDim] = useState<Dim>("all");
  // 교차 분석: 기준 문항 · 불러온 결과 (null = 불러오는 중)
  const [crossId, setCrossId] = useState<number | null>(null);
  const [cross, setCross] = useState<CrossResults | null>(null);
  // 공유 이미지로 찍을 카드 (화면 밖에 그려 둔다)
  const shareRef = useRef<ComponentRef<typeof View>>(null);
  const [sharing, setSharing] = useState(false);
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

  // 숫자 카드용 짧은 기간 "10.16~10.23"
  const shortPeriod = `${formatDate(full.started_at).slice(5)}~${formatDate(full.ended_at).slice(5)}`;
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
  // 공유 카드 큰 숫자: 하나 고르기 문항 중 1위 비율이 가장 높은 것
  const hero = full.overall.reduce<ShareHero | null>((best, q) => {
    if (q.type !== "single" || q.answered === 0) return best;
    const top = [...q.options].sort((a, b) => b.count - a.count)[0];
    const pct = top ? percent(top.count, q.answered) : 0;
    return top && (!best || pct > best.pct) ? { pct, option: top.text, question: q.text } : best;
  }, null);
  // 큰 숫자와 같은 내용(압도적 답)은 목록에서 빼고 최대 3개
  const shareInsights = insights.filter((it) => !(hero && it.title.includes(`‘${hero.option}’`))).slice(0, 3);

  // 결과 카드를 이미지로 만들어 공유 창 열기 (웹 미리보기에서는 버튼을 숨김)
  const shareImage = async () => {
    if (!shareRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(shareRef, { format: "png", quality: 1, result: "tmpfile" });
      await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: title });
    } catch {
      showNotice("이미지를 만들지 못했어요", "잠시 후 다시 시도해 주세요.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <InsightCard insights={insights} />
      {Platform.OS !== "web" && (
        <Button title="결과 카드 이미지로 공유" variant="soft" onPress={shareImage} loading={sharing} />
      )}
      {/* 공유용 카드: 화면 밖에 그려 두고 이미지로 찍는다 */}
      {Platform.OS !== "web" && (
        <View style={styles.offscreen} pointerEvents="none">
          <ShareCard
            ref={shareRef}
            title={title}
            hero={hero}
            insights={shareInsights}
            total={full.total}
            period={shortPeriod}
          />
        </View>
      )}

      <Segmented options={TABS} value={tab} onChange={setTab} />

      {tab === "questions" && (
        <>
          {/* 나눠 보기: 칩 한 줄 (화면 전체 문항에 같이 적용, 이름표 없이 칩만). 다른 문항 답별이면 기준 문항 버튼이 하나 더 */}
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dimRow}>
              {DIM_OPTIONS.filter((o) => o.value !== "cross" || crossable.length > 0).map((o) => {
                const on = o.value === dim;
                return (
                  <Pressable key={o.value} onPress={() => setDim(o.value)} style={[styles.dimChip, on && styles.dimChipOn]} hitSlop={4}>
                    <Text style={[styles.dimText, on && styles.dimTextOn]}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
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
        </>
      )}

      {/* 응답자 구성: 도넛 (2026-11-13 결정, A안 나눔 막대 대신). 그림 부품이 없는 옛 앱만 나눔 막대 */}
      {tab === "people" && <CompositionChart groups={full.groups} variant={canDrawSvg ? "donut" : "bar"} />}

      {/* 조사 정보: 신뢰도 이유(연두 상자, 기준은 point_rules) + 이름표–값 줄 (2026-11-14 데이터 허브 시안) */}
      {tab === "info" && (
        <View style={styles.infoWrap}>
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
        </View>
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
    .sort((a, b) => b.value - a.value);
  const solid = rows.filter((r) => r.n >= fewUnder);
  const maxV = solid.length > 0 ? solid[0].value : null;
  const minV = solid.length > 1 ? solid[solid.length - 1].value : null;
  const hasFew = rows.some((r) => r.n < fewUnder);
  const overall = isScale ? (q.scale?.avg ?? null) : percent(focus?.count ?? 0, q.answered);
  const unit = isScale ? "점" : "%";

  return (
    <Card>
      <QuestionHeader index={index} question={q} />

      {/* 고르기: 볼 답 고르기 */}
      {!open && !isScale && q.options.length > 1 && (
        <View style={styles.focusRow}>
          {q.options.map((o) => {
            const on = o.id === focus?.id;
            return (
              <Pressable key={o.id} onPress={() => setFocusId(o.id)} style={[styles.focusChip, on && styles.focusChipOn]} hitSlop={4}>
                <Text style={[styles.focusText, on && styles.focusTextOn]} numberOfLines={1}>
                  {o.text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {!open && rows.length > 0 && (
        <View style={styles.compare}>
          <Text style={styles.compareTitle}>
            {isScale ? (
              "묶음별 평균 점수"
            ) : (
              <>
                <Text style={styles.compareStrong}>‘{focus?.text}’</Text>라고 답한 비율
              </>
            )}
          </Text>
          {rows.map((r) => {
            const few = r.n < fewUnder;
            const hi = !few && r.value === maxV;
            const lo = !few && !hi && r.value === minV;
            return (
              <View key={r.label} style={styles.compareRow}>
                <View style={styles.compareName}>
                  <Text style={[styles.compareLabel, few && styles.fewText]} numberOfLines={1}>
                    {r.label}
                  </Text>
                  <Text style={styles.groupN}>{r.n}명</Text>
                </View>
                <View style={styles.compareTrack}>
                  <View
                    style={[
                      styles.compareFill,
                      { width: `${isScale ? (r.value / 5) * 100 : r.value}%` },
                      few ? styles.fillFew : hi ? styles.fillHi : lo ? styles.fillLo : styles.fillMid,
                    ]}
                  />
                </View>
                <Text style={[styles.compareValue, hi && styles.compareValueHi, few && styles.fewText]}>
                  {r.value}
                  {unit}
                </Text>
              </View>
            );
          })}
          {overall !== null && (
            <>
              <DashedLine />
              <View style={styles.average}>
                <Text style={styles.label}>전체 평균</Text>
                <Text style={styles.averageValue}>
                  {overall}
                  {unit}
                </Text>
              </View>
            </>
          )}
          {hasFew && (
            <Text style={styles.fewNote}>{fewUnder}명 미만 묶음은 흐리게 표시했어요. 해석에 주의해 주세요.</Text>
          )}
        </View>
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

// 가로 점선 한 줄 (한 면만 점선 테두리는 아이폰에서 안 그려져서, 높이 1 상자 안에 점선 상자를 넣고 잘라 낸다)
function DashedLine() {
  return (
    <View style={styles.dashClip}>
      <View style={styles.dash} />
    </View>
  );
}

const styles = StyleSheet.create({
  dashClip: {
    height: 1,
    overflow: "hidden",
  },
  dash: {
    height: 2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: "dashed",
    borderRadius: 1,
  },
  offscreen: {
    position: "absolute",
    left: -10000,
    top: 0,
  },
  // 나눠 보기 칩 (고르면 진한 남색)
  dimRow: {
    gap: 6,
  },
  dimChip: {
    height: 30,
    justifyContent: "center",
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  dimChipOn: {
    borderColor: colors.text,
    backgroundColor: colors.text,
  },
  dimText: {
    fontSize: fontSize.caption,
    fontWeight: "700",
    color: colors.textStrong,
  },
  dimTextOn: {
    color: colors.onPrimary,
  },
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
  // 볼 답 고르기 칩 (고르면 파랑)
  focusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  focusChip: {
    height: 28,
    justifyContent: "center",
    paddingHorizontal: 9,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  focusChipOn: {
    backgroundColor: colors.primary,
  },
  focusText: {
    maxWidth: 180,
    fontSize: fontSize.caption,
    fontWeight: "700",
    color: colors.textStrong,
  },
  focusTextOn: {
    color: colors.onPrimary,
  },
  // 묶음별 비교 막대
  compare: {
    gap: 12,
  },
  compareTitle: {
    fontSize: fontSize.small,
    color: colors.textStrong,
  },
  compareStrong: {
    fontWeight: "700",
  },
  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  compareName: {
    width: 64,
  },
  compareLabel: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.text,
  },
  compareTrack: {
    flex: 1,
    height: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  compareFill: {
    height: "100%",
    borderRadius: radius.pill,
  },
  fillHi: {
    backgroundColor: colors.primary,
  },
  fillLo: {
    backgroundColor: colors.primaryMuted,
  },
  fillMid: {
    backgroundColor: colors.onPrimaryMuted,
  },
  fillFew: {
    backgroundColor: colors.primarySoft,
  },
  compareValue: {
    width: 48,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
  },
  compareValueHi: {
    fontWeight: "800",
  },
  fewText: {
    color: colors.textSubtle,
  },
  average: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -4,
  },
  averageValue: {
    fontSize: fontSize.caption,
    fontWeight: "700",
    color: colors.text,
  },
  fewNote: {
    fontSize: fontSize.caption,
    color: colors.warning,
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
