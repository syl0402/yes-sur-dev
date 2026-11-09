import * as Sharing from "expo-sharing";
import { type ComponentRef, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { captureRef } from "react-native-view-shot";

import CompositionChart from "@/components/results/CompositionChart";
import InsightCard from "@/components/results/InsightCard";
import QuestionResult, { Bar, QuestionHeader, percent, type QuestionStats } from "@/components/results/QuestionResult";
import ShareCard, { type ShareHero } from "@/components/results/ShareCard";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import Segmented from "@/components/ui/Segmented";
import StatTile from "@/components/ui/StatTile";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatPoints } from "@/lib/format";
import { type CrossResults, type FullResults, GROUP_DIMS, type Group, type GroupDim, sortGroups } from "@/lib/hub";
import { showNotice } from "@/lib/notice";
import { buildInsights, formatSeconds } from "@/lib/resultSummary";
import { supabase } from "@/lib/supabase";

type Tab = "questions" | "people" | "info";
// 나눠 보는 기준: 전체 · 회원정보 그룹 · 다른 문항의 답(교차 분석)
type Dim = "all" | GroupDim | "cross";

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

// 전체 결과 (ys-131 열람 후 · ys-121 등록자): 핵심 인사이트 → 탭 [문항별 결과 | 응답자 | 조사 정보] (2026-11-01 정리)
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

  const crossIndex = crossable.find((c) => c.q.id === crossId)?.index ?? -1;
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
        <Button title="📷 결과 카드 이미지로 공유" variant="soft" onPress={shareImage} loading={sharing} />
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
          {/* 나눠 보는 기준 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="전체" selected={dim === "all"} onPress={() => setDim("all")} />
            {GROUP_DIMS.map((d) => (
              <Chip key={d.value} label={d.label} selected={dim === d.value} onPress={() => setDim(d.value)} />
            ))}
            {crossable.length > 0 && (
              <Chip label="문항 답별 ▾" selected={dim === "cross"} onPress={() => setDim("cross")} />
            )}
          </ScrollView>

          {/* 교차 분석: 기준 문항 고르기 */}
          {dim === "cross" && (
            <Card style={styles.crossCard}>
              <Text style={styles.crossTitle}>어떤 문항의 답별로 나눠 볼까요?</Text>
              <View style={styles.crossChips}>
                {crossable.map(({ q, index }) => (
                  <Chip
                    key={q.id}
                    label={`Q${index + 1} ${q.text.length > 14 ? `${q.text.slice(0, 14)}…` : q.text}`}
                    selected={crossId === q.id}
                    onPress={() => pickCross(q.id)}
                  />
                ))}
              </View>
              <Text style={styles.label}>예: ‘도서관’이라고 답한 사람들끼리 다른 문항은 어떻게 답했는지</Text>
            </Card>
          )}

          {dim === "all" && questions.map((q, index) => <QuestionResult key={q.id} index={index} question={q} />)}

          {dim !== "all" &&
            dim !== "cross" &&
            full.overall.map((q, index) => (
              <GroupedQuestion key={q.id} index={index} question={q} groups={sortGroups(dim, full.groups[dim])} />
            ))}

          {dim === "cross" &&
            crossId !== null &&
            (cross === null ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Text style={styles.crossHint}>Q{crossIndex + 1}의 답별로 나눠 봤어요</Text>
                {full.overall.map((q, index) =>
                  q.id === crossId ? null : <GroupedQuestion key={q.id} index={index} question={q} groups={cross.groups} />,
                )}
              </>
            ))}
        </>
      )}

      {tab === "people" && <CompositionChart groups={full.groups} />}

      {tab === "info" && (
        <>
          <View style={styles.tiles}>
            <StatTile label="유효 응답" value={`${full.total}명`} />
            <StatTile label="확인 문항 통과율" value={full.pass_rate !== null ? `${full.pass_rate}%` : "-"} />
          </View>
          <View style={styles.tiles}>
            <StatTile label="평균 응답 시간" value={full.avg_seconds !== null ? formatSeconds(full.avg_seconds) : "-"} />
            <StatTile label="조사 기간" value={shortPeriod} />
          </View>
          {(full.excluded > 0 || full.share_earned !== null) && (
            <Card>
              {full.excluded > 0 && <Text style={styles.body}>확인 문항 오답 {full.excluded}건은 결과에서 뺐어요.</Text>}
              {full.share_earned !== null && (
                <Text style={styles.earned}>
                  열람 {full.view_count}회{showEarnings ? ` · 열람 수익 +${formatPoints(full.share_earned)}` : ""}
                </Text>
              )}
            </Card>
          )}
        </>
      )}
    </>
  );
}

// 문항 하나를 묶음별로 (회원정보 그룹 또는 교차 분석).
// 접힘: 묶음마다 한 줄 (1위 답 · 비율, 척도는 평균) / 펼침: 묶음마다 전체 막대. 5명 미만 묶음은 맨 아래 한 줄로
function GroupedQuestion({ index, question: q, groups }: { index: number; question: QuestionStats; groups: Group[] }) {
  const [open, setOpen] = useState(false);
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

  return (
    <Card>
      <QuestionHeader index={index} question={q} />

      {!open &&
        shown.map(({ g, s }) => {
          if (q.type === "scale") {
            const avg = s.scale?.avg ?? 0;
            return (
              <View key={g.label} style={styles.line}>
                <Text style={styles.lineLabel} numberOfLines={1}>
                  {g.label} <Text style={styles.groupN}>{g.n}명</Text>
                </Text>
                <View style={styles.lineTrack}>
                  <View style={[styles.lineFill, { width: `${(avg / 5) * 100}%` }]} />
                </View>
                <Text style={styles.lineValue}>{avg}점</Text>
              </View>
            );
          }
          const top = [...s.options].sort((a, b) => b.count - a.count)[0];
          const pct = top ? percent(top.count, s.answered) : 0;
          return (
            <View key={g.label} style={styles.line}>
              <Text style={styles.lineLabel} numberOfLines={1}>
                {g.label} <Text style={styles.groupN}>{g.n}명</Text>
              </Text>
              <Text style={styles.lineTop} numberOfLines={1}>
                {top?.text ?? "-"}
              </Text>
              <Text style={styles.lineValue}>{pct}%</Text>
            </View>
          );
        })}

      {open &&
        shown.map(({ g, s }) => {
          const max = Math.max(0, ...s.options.map((o) => o.count));
          return (
            <View key={g.label} style={styles.group}>
              <Text style={styles.groupTitle}>
                {g.label} <Text style={styles.groupN}>{g.n}명</Text>
              </Text>
              {q.type === "scale" ? (
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
          <Text style={styles.moreText}>{open ? "접기 ▴" : q.type === "scale" ? "점수 분포 보기 ▾" : "모든 답 보기 ▾"}</Text>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  offscreen: {
    position: "absolute",
    left: -10000,
    top: 0,
  },
  chips: {
    gap: spacing.sm,
  },
  tiles: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  body: {
    fontSize: fontSize.small,
    color: colors.text,
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
  earned: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.primary,
  },
  crossCard: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
  crossTitle: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.primary,
  },
  crossChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  crossHint: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
  },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lineLabel: {
    width: 104,
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.text,
  },
  lineTop: {
    flex: 1,
    fontSize: fontSize.small,
    color: colors.text,
  },
  lineTrack: {
    flex: 1,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  lineFill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  lineValue: {
    minWidth: 40,
    textAlign: "right",
    fontSize: fontSize.small,
    fontWeight: "800",
    color: colors.primary,
  },
  group: {
    gap: 6,
    padding: spacing.sm,
    borderRadius: radius.md,
    // 카드 안 옅은 상자 (화면 바탕이 흰색이 되어 회색 상자 색으로, 2026-11-09)
    backgroundColor: colors.surfaceMuted,
  },
  groupTitle: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.text,
  },
  groupN: {
    fontSize: fontSize.caption,
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
