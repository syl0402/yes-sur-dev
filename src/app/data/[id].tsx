// ys-131 결과 상세 · F-502~504 (무료 정보 → 내 답 비교 → 열람 → 전체 결과. 2026-11-01 정리: 뱃지 머리 · 구성 차트 · 아래 고정 열람 버튼
// · 2026-11-14 데이터 허브 시안 Preview: 열람 전 요약 3칸 · 인사이트 1개 공개 + 나머지 잠금 · 문항 목록(결과 잠금) · 응답자 구성은 열람 후)
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import PrimaryButton from "@/components/PrimaryButton";
import ReportLink from "@/components/ReportLink";
import ResultsActionBar from "@/components/results/ResultsActionBar";
import ResultsView from "@/components/results/ResultsView";
import Badge from "@/components/ui/Badge";
import BottomBar from "@/components/ui/BottomBar";
import Card from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { bookmarkIcons, uiIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { formatPoints, formatShortDate } from "@/lib/format";
import {
  type Comparison,
  FREE_REASON_LABELS,
  type FullResults,
  type HubPreview,
  type HubTeaser,
} from "@/lib/hub";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";
import { QUESTION_TYPE_LABELS, SCALE_LABELS } from "@/lib/surveyDraft";
import { formatHost } from "@/lib/surveys";

type Loaded = {
  preview: HubPreview;
  // 열람 전 미리보는 인사이트 1개
  teaser: HubTeaser | null;
  // 내가 스크랩한 결과인지
  saved: boolean;
  // 내 포인트 (열람 버튼 위 안내)
  balance: number | null;
  comparison: Comparison[] | null;
  full: FullResults | null;
};

// 무료 정보 + (응답자면) 내 답 비교 + (열람했으면) 전체 결과
async function fetchAll(id: number): Promise<Loaded | string> {
  const { data, error } = await supabase.rpc("get_hub_preview", { p_survey_id: id });
  if (error) return errorMessage(error);
  const preview = data as HubPreview;

  const canSeeFull = preview.viewed || preview.mine;
  const [comparison, full, teaser, bookmarks, balance] = await Promise.all([
    preview.answered && !canSeeFull
      ? supabase.rpc("get_my_comparison", { p_survey_id: id }).then(({ data }) => data as Comparison[])
      : Promise.resolve(null),
    canSeeFull
      ? supabase.rpc("get_full_results", { p_survey_id: id }).then(({ data }) => data as FullResults)
      : Promise.resolve(null),
    canSeeFull
      ? Promise.resolve(null)
      : supabase.rpc("get_hub_teaser", { p_survey_id: id }).then(({ data }) => (data as HubTeaser | null) ?? null),
    supabase.rpc("get_my_bookmarks").then(({ data }) => (data as number[] | null) ?? []),
    canSeeFull
      ? Promise.resolve(null)
      : supabase.rpc("get_my_balance").then(({ data }) => (typeof data === "number" ? data : null)),
  ]);
  return { preview, comparison, full, teaser, saved: bookmarks.includes(id), balance };
}

export default function HubResult() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const surveyId = Number(id);
  // undefined = 불러오는 중, string = 오류 문구
  const [loaded, setLoaded] = useState<Loaded | string | undefined>(undefined);
  const [viewing, setViewing] = useState(false);

  const load = useCallback(() => {
    fetchAll(surveyId).then(setLoaded);
  }, [surveyId]);

  useFocusEffect(load);

  if (loaded === undefined || typeof loaded === "string") {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "설문 결과" }} />
        {loaded === undefined ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.muted}>{loaded}</Text>
        )}
      </View>
    );
  }

  const { preview: p, comparison, full, teaser, saved, balance } = loaded;

  // 스크랩 ↔ 해제 (먼저 화면을 바꾸고, 실패하면 되돌린다)
  const toggleSaved = async () => {
    setLoaded({ ...loaded, saved: !saved });
    const { data, error } = await supabase.rpc("toggle_bookmark", { p_survey_id: surveyId });
    if (error) {
      setLoaded({ ...loaded, saved });
      showNotice("스크랩하지 못했어요", errorMessage(error));
      return;
    }
    setLoaded({ ...loaded, saved: data === true });
  };

  // 전체 열람: 서버가 무료 여부·차감·등록자 분배를 한 번에 처리
  const view = async () => {
    setViewing(true);
    const { error } = await supabase.rpc("view_survey", { p_survey_id: surveyId });
    setViewing(false);
    if (error) {
      showNotice("열람하지 못했어요", errorMessage(error));
      return;
    }
    load();
  };

  const confirmView = () =>
    p.free_reason
      ? view()
      : showConfirm({
          title: `${formatPoints(p.price)}로 전체 결과를 볼까요?`,
          message: "한 번 열람하면 계속 볼 수 있어요.",
          okLabel: "열람",
          cancelLabel: "취소",
          onOk: view,
        });

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: "설문 결과",
          headerRight: () => (
            <Pressable onPress={toggleSaved} hitSlop={10}>
              <AppIcon name={saved ? bookmarkIcons.on : bookmarkIcons.off} size={24} color={colors.primary} />
            </Pressable>
          ),
        }}
      />

      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
        {/* ── 누구나 (무료): 설문 정보 ── */}
        <View style={styles.header}>
          {/* 표시는 카테고리 · 신뢰도만, 주최는 아래 정보 줄로 (2026-11-10 정리) */}
          <View style={styles.badges}>
            <Badge label={p.category_name} tone="blue" />
            {p.trusted && <Badge label="✓ 신뢰도 높음" tone="lime" />}
          </View>
          <Text style={styles.title}>{p.title}</Text>
          {p.description ? <Text style={styles.desc}>{p.description}</Text> : null}
          {full ? (
            <Text style={styles.meta}>
              {formatHost(p)} · 응답 {p.response_count}명 · {formatShortDate(p.ended_at)} 마감
            </Text>
          ) : (
            <Text style={styles.meta}>{formatHost(p)}</Text>
          )}
          {p.low_count && <Text style={styles.warning}>응답 수가 적어 참고용으로만 봐 주세요.</Text>}
        </View>

        {/* ── 열람 전 미리보기 (2026-11-14 시안 Preview) ── */}
        {!full && (
          <>
            {/* 요약 3칸: 응답 · 문항 · 조사 기간 */}
            <View style={styles.summary}>
              <SummaryCell label="응답" value={`${p.response_count}명`} />
              <SummaryCell label="문항" value={`${p.questions.length}개`} divided />
              <SummaryCell label="조사 기간" value={formatPeriod(p.started_at, p.ended_at)} />
            </View>

            {/* 핵심 인사이트: 1개만 공개, 나머지는 잠금 */}
            {teaser && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>핵심 인사이트</Text>
                <View style={styles.insightBox}>
                  <View style={styles.insightRow}>
                    <View style={styles.insightIcon}>
                      <AppIcon name={uiIcons.insight} size={18} color={colors.primary} />
                    </View>
                    <View style={styles.insightMain}>
                      <Text style={styles.insightTitle}>
                        응답자 {teaser.pct}%가 ‘{teaser.option}’
                      </Text>
                      <Text style={styles.insightSub} numberOfLines={1}>
                        {teaser.index}번 · {teaser.question}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.insightRow, styles.insightLine]} accessibilityLabel="잠긴 인사이트">
                    <View style={styles.insightIcon}>
                      <AppIcon name={uiIcons.lock} size={16} color={colors.primaryMuted} />
                    </View>
                    {/* 흐린 글자 대신 자리만 (열람하면 보여요) */}
                    <View style={styles.lockedBar} />
                  </View>
                </View>
              </View>
            )}

            {/* 이런 문항의 결과를 볼 수 있어요: 문항 목록 + 잠금 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>이런 문항의 결과를 볼 수 있어요</Text>
              <View>
                {p.questions.map((q, i) => (
                  <View key={i} style={styles.questionRow}>
                    <Text style={styles.questionNo}>Q{i + 1}</Text>
                    <View style={styles.questionMain}>
                      <Text style={styles.questionText}>{q.text}</Text>
                      <Text style={styles.questionType}>{QUESTION_TYPE_LABELS[q.type]}</Text>
                    </View>
                    <AppIcon name={uiIcons.lock} size={16} color={colors.textSubtle} />
                  </View>
                ))}
              </View>
              <Text style={styles.plus}>+ 응답자 구성(성별·나이대·학년·계열)과 조사 정보</Text>
            </View>
          </>
        )}

        {/* ── 응답자 (무료): 내 답 비교 ── */}
        {comparison && (
          <Card>
            <Text style={styles.boxTitle}>내 답 비교</Text>
            {comparison.map((c, i) => (
              <View key={i} style={[styles.compareRow, i > 0 && styles.divider]}>
                <Text style={styles.body}>{c.text}</Text>
                {c.mine.map((m, j) => (
                  <Text key={j} style={styles.compare}>
                    나: {c.type === "scale" ? `${m}점 (${SCALE_LABELS[Number(m) - 1]})` : m} · 나와 같은 답 {c.same_pct[j]}%
                  </Text>
                ))}
              </View>
            ))}
          </Card>
        )}

        {/* ── 열람 (전체 결과) ── */}
        {full && <ResultsView surveyId={surveyId} full={full} title={p.title} />}

        {!p.mine && <ReportLink surveyId={surveyId} />}
      </ScrollView>

      {/* ── 열람 후: 출처 복사 · 집계 CSV (화면 아래 고정) ── */}
      {full && <ResultsActionBar full={full} title={p.title} host={formatHost(p)} />}

      {/* ── 열람 버튼 (화면 아래 고정) ── */}
      {!full && (
        <BottomBar
          note={
            p.free_reason
              ? FREE_REASON_LABELS[p.free_reason]
              : `한 번 열면 계속 볼 수 있어요${balance !== null ? ` · 내 포인트 ${formatPoints(balance)}` : ""}`
          }
        >
          <View style={styles.viewBox}>
            <PrimaryButton
              title={p.free_reason ? "무료로 전체 결과 보기" : `${formatPoints(p.price)}로 전체 결과 보기`}
              onPress={confirmView}
              loading={viewing}
            />
          </View>
        </BottomBar>
      )}
    </View>
  );
}

// 조사 기간 "10.16~23" (달이 다르면 "10.28~11.4")
function formatPeriod(start: string, end: string): string {
  const a = new Date(start);
  const b = new Date(end);
  return a.getMonth() === b.getMonth()
    ? `${a.getMonth() + 1}.${a.getDate()}~${b.getDate()}`
    : `${formatShortDate(start)}~${formatShortDate(end)}`;
}

// 요약 칸 하나 (작은 이름표 + 굵은 값). divided면 양옆 세로 선
function SummaryCell({ label, value, divided }: { label: string; value: string; divided?: boolean }) {
  return (
    <View style={[styles.cell, divided && styles.cellDivided]}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 20,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 30,
  },
  desc: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
  },
  body: {
    fontSize: fontSize.body,
    color: colors.text,
    lineHeight: 23,
  },
  meta: {
    fontSize: fontSize.small,
    color: colors.textSubtle,
  },
  label: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  warning: {
    fontSize: fontSize.small,
    color: colors.danger,
  },
  hint: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    textAlign: "center",
  },
  muted: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: "center",
  },
  boxTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  summary: {
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  cellDivided: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  cellLabel: {
    fontSize: fontSize.caption,
    color: colors.iconStrong,
  },
  cellValue: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },
  section: {
    marginTop: spacing.sm,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  insightBox: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
  },
  insightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  insightLine: {
    borderTopWidth: 1,
    borderTopColor: colors.onPrimaryMuted,
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  insightMain: {
    flex: 1,
    gap: 2,
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  insightSub: {
    fontSize: fontSize.caption,
    color: colors.iconStrong,
  },
  lockedBar: {
    flex: 1,
    maxWidth: 200,
    height: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.onPrimaryMuted,
  },
  questionRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  questionMain: {
    flex: 1,
    gap: 2,
    paddingVertical: spacing.sm,
  },
  questionType: {
    fontSize: fontSize.caption,
    color: colors.iconStrong,
  },
  plus: {
    fontSize: fontSize.small,
    color: colors.iconStrong,
  },
  questionNo: {
    width: 28,
    fontSize: fontSize.small,
    fontWeight: "800",
    color: colors.primary,
  },
  questionText: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.text,
  },
  compareRow: {
    gap: 2,
    paddingVertical: spacing.sm,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  compare: {
    fontSize: fontSize.small,
    color: colors.primary,
    fontWeight: "600",
  },
  viewBox: {
    flex: 1,
    gap: spacing.xs,
  },
});
