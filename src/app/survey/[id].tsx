// ys-111 설문 상세 · F-205
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import ReportLink from "@/components/ReportLink";
import Badge from "@/components/ui/Badge";
import BottomBar from "@/components/ui/BottomBar";
import Card from "@/components/ui/Card";
import StatTile from "@/components/ui/StatTile";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatPoints, formatTimeLeft } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { formatHost, remainingSpots } from "@/lib/surveys";

// 응답 전 결과 공개 안내 (결과 공개 범위별)
const VISIBILITY_NOTICE: Record<"public" | "campus" | "private", string> = {
  public: "이 설문 결과는 개인을 알 수 없게 묶어서 데이터 허브에 공개돼요. 주관식 답은 공개되지 않아요.",
  campus: "이 설문 결과는 개인을 알 수 없게 묶어서 우리 학교 학생에게만 공개돼요. 주관식 답은 공개되지 않아요.",
  private: "이 설문 결과는 등록자만 봐요.",
};

type Detail = {
  title: string;
  description: string | null;
  question_count: number;
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

  const [{ data: survey }, { data: response }, { data: profile }] = await Promise.all([
    supabase
      .from("surveys")
      .select(
        "owner_id, title, description, question_count, est_minutes, reward_points, target_responses, response_count, audience, status, closes_at, host_name, host_verified, result_visibility, survey_categories(name)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("responses").select("status").eq("survey_id", id).maybeSingle(),
    supabase.from("profiles").select("account_type").maybeSingle(),
  ]);

  if (!survey) return null;

  const raw = survey.survey_categories as unknown;
  const category = (Array.isArray(raw) ? raw[0] : raw) as { name: string } | null;

  return {
    title: survey.title,
    description: survey.description,
    question_count: survey.question_count,
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

export default function SurveyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // undefined = 불러오는 중, null = 찾을 수 없음
  const [detail, setDetail] = useState<Detail | null | undefined>(undefined);

  // 화면에 돌아올 때마다 새로 불러온다 (응답 화면에서 나왔을 때 마감·참여 상태가 바로 바뀌게)
  useFocusEffect(
    useCallback(() => {
      fetchDetail(Number(id)).then(setDetail);
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

  const join = () => router.push({ pathname: "/survey/respond", params: { id: String(id) } });

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "설문 상세" }} />

      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
        <Card>
          <View style={styles.badges}>
            {detail.categoryName ? <Badge label={detail.categoryName} /> : null}
            {detail.audience === "campus" && <Badge label="우리 학교 학생만" tone="accent" />}
            {detail.closed && <Badge label="마감" tone="muted" />}
          </View>
          <Text style={styles.title}>{detail.title}</Text>
          {detail.description ? <Text style={styles.description}>{detail.description}</Text> : null}
          <Text style={styles.host}>
            {detail.host_verified ? `${formatHost(detail)} 인증 단체` : `작성 · ${formatHost(detail)}`}
          </Text>
        </Card>

        <View style={styles.stats}>
          <StatTile label="보상" value={`+${formatPoints(detail.reward_points)}`} />
          <StatTile label="소요 시간" value={`약 ${detail.est_minutes}분`} />
          <StatTile label="남은 자리" value={`${spots}명`} />
        </View>

        <Card>
          <InfoRow label="문항 수" value={`${detail.question_count}문항`} />
          <InfoRow label="마감" value={formatTimeLeft(detail.closes_at) || "기한 없음"} />
          <InfoRow label="응답 대상" value={detail.audience === "campus" ? "우리 학교 학생" : "전체 대학생"} />
        </Card>

        {/* 응답 전에 결과가 어디까지 공개되는지 알린다 (2026-10-30 결정) */}
        {!detail.isOwner && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>ⓘ {VISIBILITY_NOTICE[detail.result_visibility]}</Text>
          </View>
        )}

        {detail.isOwner && <Text style={styles.muted}>내가 올린 설문이에요.</Text>}
        {!detail.isOwner && <ReportLink surveyId={Number(id)} />}
      </ScrollView>

      <BottomBar>
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
              title={detail.rejected ? "다시 응답하기" : `참여하고 ${formatPoints(detail.reward_points)} 받기`}
              onPress={join}
            />
          )}
        </View>
      </BottomBar>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
    gap: spacing.md,
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
  description: {
    fontSize: fontSize.body,
    color: colors.text,
    lineHeight: 24,
  },
  host: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  stats: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  infoLabel: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: fontSize.body,
    color: colors.text,
    fontWeight: "600",
  },
  notice: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  noticeText: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    lineHeight: 19,
  },
  action: {
    flex: 1,
    justifyContent: "center",
  },
  muted: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: "center",
  },
});
