// ys-111 설문 상세 · F-205 (2026-11-12 설문 흐름 시안 respond/Main: 요약 3칸 · 남은 자리 막대 · 이런 설문이에요 · 받을 수 있는 보상)
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import LinkedText from "@/components/LinkedText";
import PrimaryButton from "@/components/PrimaryButton";
import ReportLink from "@/components/ReportLink";
import Badge from "@/components/ui/Badge";
import BottomBar from "@/components/ui/BottomBar";
import Button from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { homeIcons, uiIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { formatAgo, formatDday, formatPoints } from "@/lib/format";
import { showNotice } from "@/lib/notice";
import { fetchSurveyReward } from "@/lib/rewards";
import { supabase } from "@/lib/supabase";
import { formatHost, remainingSpots, schoolShort } from "@/lib/surveys";

// 응답 전 결과 공개 안내 (결과 공개 범위별) + 성의 없는 응답 안내
const VISIBILITY_NOTICE: Record<"public" | "campus" | "private", string> = {
  public: "결과는 개인을 알 수 없게 묶어서 데이터 허브에 공개돼요. 주관식 답은 공개되지 않아요.",
  campus: "결과는 개인을 알 수 없게 묶어서 우리 학교 학생에게만 공개돼요. 주관식 답은 공개되지 않아요.",
  private: "결과는 등록자만 봐요.",
};
const CAREFUL_NOTICE = "너무 빠르거나 성의 없는 응답은 포인트를 받을 수 없어요.";

type Detail = {
  title: string;
  description: string | null;
  question_count: number;
  // 문항 구성 (응답 대상만 문항이 읽힌다. 못 읽으면 둘 다 0)
  choiceCount: number;
  textCount: number;
  est_minutes: number;
  reward_points: number;
  target_responses: number;
  response_count: number;
  audience: "all" | "campus";
  status: "open" | "closed";
  closes_at: string | null;
  categoryName: string;
  host_name: string | null;
  host_verified: boolean;
  result_visibility: "public" | "campus" | "private";
  createdAt: string;
  // 내 학교 이름 (교내 설문은 내 학교 것만 보이므로 응답 대상 표시에 쓴다, 2026-11-13)
  schoolName: string;
  // 참여하기 버튼 상태를 정하는 정보
  isOwner: boolean;
  isOrg: boolean;
  answered: boolean;
  // 확인 문항을 틀려 반려된 응답이 있음 → 다시 응답 가능
  rejected: boolean;
  // 마감됨: 상태 마감 · 자리 없음 · 마감일 지남 (불러올 때 계산)
  closed: boolean;
};

// 설문 상세 + 내 상태 (응답 대상이 아니면 DB 권한 때문에 설문이 안 읽힌다 → 찾을 수 없음)
async function fetchDetail(id: number): Promise<Detail | null> {
  const { data: auth } = await supabase.auth.getUser();
  const myId = auth.user?.id;

  const [{ data: survey }, { data: response }, { data: profile }, { data: questions }] = await Promise.all([
    supabase
      .from("surveys")
      .select(
        "owner_id, title, description, question_count, est_minutes, reward_points, target_responses, response_count, audience, status, closes_at, host_name, host_verified, result_visibility, created_at, survey_categories(name)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("responses").select("status").eq("survey_id", id).maybeSingle(),
    supabase.from("profiles").select("account_type, universities(name)").maybeSingle(),
    supabase.from("questions").select("type").eq("survey_id", id),
  ]);
  const uniRaw = profile?.universities as unknown;
  const schoolName = ((Array.isArray(uniRaw) ? uniRaw[0] : uniRaw) as { name: string } | null)?.name ?? "";

  if (!survey) return null;

  const raw = survey.survey_categories as unknown;
  const category = (Array.isArray(raw) ? raw[0] : raw) as { name: string } | null;
  const types = (questions ?? []).map((q) => q.type as string);

  return {
    title: survey.title,
    description: survey.description,
    question_count: survey.question_count,
    choiceCount: types.filter((t) => t !== "text").length,
    textCount: types.filter((t) => t === "text").length,
    est_minutes: survey.est_minutes,
    reward_points: survey.reward_points,
    target_responses: survey.target_responses,
    response_count: survey.response_count,
    audience: survey.audience,
    status: survey.status,
    closes_at: survey.closes_at,
    categoryName: category?.name ?? "",
    host_name: survey.host_name,
    host_verified: survey.host_verified,
    result_visibility: survey.result_visibility,
    createdAt: survey.created_at,
    schoolName,
    isOwner: survey.owner_id === myId,
    isOrg: profile?.account_type === "org",
    answered: response?.status === "confirmed",
    rejected: response?.status === "rejected",
    closed:
      survey.status !== "open" ||
      remainingSpots(survey) <= 0 ||
      (survey.closes_at !== null && new Date(survey.closes_at).getTime() <= Date.now()),
  };
}

// "객관식 3문항 · 주관식 없음" (문항을 못 읽으면 전체 문항 수만)
function composition(d: Detail): string {
  if (d.choiceCount + d.textCount === 0) return `${d.question_count}문항`;
  const choice = d.choiceCount > 0 ? `객관식 ${d.choiceCount}문항` : "객관식 없음";
  const text = d.textCount > 0 ? `주관식 ${d.textCount}문항` : "주관식 없음";
  return `${choice} · ${text}`;
}

export default function SurveyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // undefined = 불러오는 중, null = 찾을 수 없음
  const [detail, setDetail] = useState<Detail | null | undefined>(undefined);
  // 보상 안내 (보상 연락처를 받는 설문만, 2026-11-07)
  const [reward, setReward] = useState<string | null>(null);

  // 화면에 돌아올 때마다 새로 불러온다 (응답 화면에서 나왔을 때 마감·참여 상태가 바로 바뀌게)
  useFocusEffect(
    useCallback(() => {
      fetchDetail(Number(id)).then(setDetail);
      fetchSurveyReward(Number(id)).then(setReward);
    }, [id]),
  );

  if (detail === undefined) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "설문 상세" }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (detail === null) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "설문 상세" }} />
        <Text style={styles.muted}>찾을 수 없는 설문이에요.</Text>
      </View>
    );
  }

  const spots = remainingSpots(detail);
  const filled = detail.target_responses > 0 ? Math.min(detail.response_count / detail.target_responses, 1) : 0;
  const points = formatPoints(detail.reward_points);

  // 삭제: 돌려줄 금액은 서버가 정하고 알려 준다
  const confirmDelete = () =>
    showConfirm({
      title: "설문을 삭제할까요?",
      message: "삭제하면 되돌릴 수 없어요. 낸 등록비는 돌려드려요.",
      okLabel: "삭제",
      cancelLabel: "취소",
      destructive: true,
      onOk: async () => {
        const { data, error } = await supabase.rpc("delete_survey", { p_survey_id: Number(id) });
        if (error) {
          showNotice("삭제하지 못했어요", errorMessage(error));
          return;
        }
        const refund = typeof data === "number" ? data : 0;
        showNotice("삭제했어요", refund > 0 ? `등록비 ${formatPoints(refund)}를 돌려드렸어요.` : "설문을 지웠어요.", () =>
          router.back(),
        );
      },
    });

  const join = () => router.push({ pathname: "/survey/respond", params: { id: String(id) } });

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "설문 상세" }} />

      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
        {/* 맨 위: 카테고리 · 교내 알약 → 제목 → 작성자(인증 단체) */}
        <View style={styles.head}>
          <View style={styles.badges}>
            {detail.categoryName ? <Badge label={detail.categoryName} tone="blue" /> : null}
            {detail.audience === "campus" && (
              <Badge label={detail.schoolName ? `${schoolShort(detail.schoolName)}생만` : "우리 학교 학생만"} tone="lime" />
            )}
            {detail.closed && <Badge label="마감" tone="muted" />}
          </View>
          <Text style={styles.title}>{detail.title}</Text>
          <View style={styles.hostRow}>
            <Text style={styles.host}>{formatHost(detail)}</Text>
            {detail.host_verified && (
              <View style={styles.verified}>
                <AppIcon name={uiIcons.verified} size={14} color={colors.primary} />
                <Text style={styles.verifiedText}>인증 단체</Text>
              </View>
            )}
            <Text style={styles.host}>· {formatAgo(detail.createdAt)}</Text>
          </View>
        </View>

        {/* 요약 3칸: 포인트 · 소요 시간 · 마감 */}
        <View style={styles.summary}>
          <SummaryCell label="포인트" value={`+${points}`} strong />
          <SummaryCell label="소요 시간" value={`${detail.est_minutes}분`} divided />
          <SummaryCell label="마감" value={formatDday(detail.closes_at)} />
        </View>
        <View style={styles.audienceRow}>
          <AppIcon name={uiIcons.audience} size={15} color={colors.textSubtle} />
          <Text style={styles.audienceText}>
            응답 대상{" "}
            <Text style={styles.audienceValue}>
              {detail.audience === "campus" ? `${detail.schoolName || "우리 학교"} 학생만` : "전체 대학생"}
            </Text>
          </Text>
        </View>

        {/* 남은 자리 막대 (목표 인원이 차면 자동 마감) */}
        <View style={styles.box}>
          <View style={styles.spotsTop}>
            <Text style={styles.spotsTitle}>
              {detail.closed ? (
                "마감된 설문이에요"
              ) : (
                <>
                  선착순 <Text style={styles.spotsStrong}>{spots}자리</Text> 남았어요
                </>
              )}
            </Text>
            <Text style={styles.spotsCount}>
              {detail.response_count} / {detail.target_responses}명 응답
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${filled * 100}%` }]} />
          </View>
        </View>

        {/* 이런 설문이에요: 설명 + 문항 구성 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>이런 설문이에요</Text>
          {detail.description ? (
            <LinkedText style={styles.description} selectable>
              {detail.description}
            </LinkedText>
          ) : null}
          <Text style={styles.compose}>{composition(detail)}</Text>
        </View>

        {/* 받을 수 있는 보상: 포인트(모두) / 작성자 보상(안내 글 + 응답 후 연락처) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>받을 수 있는 보상</Text>
          <View style={[styles.box, styles.rewardBox]}>
            <View style={styles.rewardRow}>
              <View style={[styles.rewardIcon, styles.rewardIconBlue]}>
                <AppIcon name={homeIcons.coin} size={22} color={colors.primary} />
              </View>
              <View style={styles.rewardMain}>
                <Text style={styles.rewardTitle}>포인트 {points}</Text>
                <Text style={styles.rewardSub}>응답하면 바로 자동 적립</Text>
              </View>
              <Badge label="모두" tone="blue" />
            </View>
            {reward && (
              <View style={[styles.rewardRow, styles.rewardRowLine]}>
                <View style={[styles.rewardIcon, styles.rewardIconLime]}>
                  <AppIcon name={uiIcons.gift} size={20} color={colors.onAccentSoft} />
                </View>
                <View style={styles.rewardMain}>
                  <LinkedText style={styles.rewardNote} selectable>
                    {reward}
                  </LinkedText>
                  {!detail.isOwner && <Text style={styles.rewardSub}>응답 후 연락처를 남기면 받을 수 있어요 (선택)</Text>}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* 응답 전에 결과가 어디까지 공개되는지 알린다 (2026-10-30 결정) */}
        {!detail.isOwner && (
          <View style={styles.noticeRow}>
            <AppIcon name={uiIcons.privacy} size={16} color={colors.textSubtle} />
            <Text style={styles.noticeText}>
              {VISIBILITY_NOTICE[detail.result_visibility]} {CAREFUL_NOTICE}
            </Text>
          </View>
        )}

        {detail.isOwner && <Text style={styles.muted}>내가 올린 설문이에요.</Text>}
        {/* 정상 응답 0명일 때만 삭제 (2026-11-10). 확인 문항 오답 응답은 함께 지워진다 */}
        {detail.isOwner && detail.response_count === 0 && (
          <Pressable onPress={confirmDelete} hitSlop={8} style={styles.deleteLink}>
            <Text style={styles.deleteText}>설문 삭제</Text>
          </Pressable>
        )}
        {!detail.isOwner && <ReportLink surveyId={Number(id)} />}
      </ScrollView>

      <BottomBar>
        {/* 내 진행 중 설문: 수정하기를 결과 보기 옆에 바로 (2026-11-08) */}
        {detail.isOwner && !detail.closed && (
          <Button
            title="수정하기"
            variant="outline"
            onPress={() => router.push({ pathname: "/survey/edit", params: { id: String(id) } })}
            style={styles.side}
          />
        )}
        <View style={styles.action}>
          {detail.isOwner ? (
            <PrimaryButton
              title="결과 보기"
              onPress={() => router.push({ pathname: "/survey/results", params: { id: String(id) } })}
            />
          ) : detail.isOrg ? (
            <Text style={styles.muted}>단체 계정은 설문에 응답할 수 없어요.</Text>
          ) : detail.answered ? (
            <PrimaryButton title="이미 참여한 설문이에요" onPress={() => {}} disabled />
          ) : detail.closed ? (
            <PrimaryButton title="마감된 설문이에요" onPress={() => {}} disabled />
          ) : (
            <PrimaryButton
              title={detail.rejected ? "다시 응답하기" : `${detail.est_minutes}분 만에 ${points} 받기`}
              onPress={join}
            />
          )}
        </View>
      </BottomBar>
    </View>
  );
}

// 요약 칸 하나 (작은 이름표 + 큰 값). divided면 양옆에 세로 선
function SummaryCell({ label, value, strong, divided }: { label: string; value: string; strong?: boolean; divided?: boolean }) {
  return (
    <View style={[styles.cell, divided && styles.cellDivided]}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, strong && styles.cellValueStrong]}>{value}</Text>
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
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: 12,
  },
  head: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
    gap: 10,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  title: {
    marginTop: spacing.xs,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 32,
    color: colors.text,
  },
  hostRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  host: {
    fontSize: fontSize.label,
    color: colors.iconStrong,
  },
  verified: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  verifiedText: {
    fontSize: fontSize.caption,
    fontWeight: "700",
    color: colors.primary,
  },
  summary: {
    flexDirection: "row",
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
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
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  cellValueStrong: {
    color: colors.primary,
  },
  audienceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.xs,
  },
  audienceText: {
    fontSize: fontSize.small,
    color: colors.iconStrong,
  },
  audienceValue: {
    fontWeight: "700",
    color: colors.text,
  },
  box: {
    gap: 10,
    paddingVertical: spacing.md,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  spotsTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  spotsTitle: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  spotsStrong: {
    color: colors.primary,
  },
  spotsCount: {
    fontSize: fontSize.caption,
    color: colors.iconStrong,
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    overflow: "hidden",
  },
  fill: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  section: {
    marginTop: spacing.md,
    gap: 10,
  },
  sectionTitle: {
    paddingHorizontal: spacing.xs,
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },
  description: {
    paddingHorizontal: spacing.xs,
    fontSize: 15,
    lineHeight: 25,
    color: colors.textStrong,
  },
  compose: {
    paddingHorizontal: spacing.xs,
    fontSize: fontSize.small,
    color: colors.iconStrong,
  },
  rewardBox: {
    gap: 0,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  rewardRowLine: {
    alignItems: "flex-start",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rewardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rewardIconBlue: {
    backgroundColor: colors.primarySoft,
  },
  rewardIconLime: {
    backgroundColor: colors.accentSoft,
  },
  rewardMain: {
    flex: 1,
    gap: 2,
  },
  rewardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  rewardNote: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
    color: colors.text,
  },
  rewardSub: {
    fontSize: fontSize.small,
    color: colors.iconStrong,
  },
  noticeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  noticeText: {
    flex: 1,
    fontSize: fontSize.small,
    lineHeight: 21,
    color: colors.iconStrong,
  },
  action: {
    flex: 1,
    justifyContent: "center",
  },
  side: {
    flex: 1,
  },
  muted: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: "center",
  },
  deleteLink: {
    alignSelf: "center",
  },
  deleteText: {
    fontSize: fontSize.small,
    color: colors.danger,
    textDecorationLine: "underline",
  },
});
