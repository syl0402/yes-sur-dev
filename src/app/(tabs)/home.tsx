// ys-100 홈 · F-201, F-702
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import { colors, fontSize, spacing } from "@/constants/theme";
import { formatPoints, formatTimeLeft } from "@/lib/format";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

type SurveyItem = {
  id: number;
  title: string;
  est_minutes: number;
  reward_points: number;
  closes_at: string | null;
  survey_categories: { name: string } | null;
};

type HomeData = {
  isOrg: boolean;
  balance: number;
  surveys: SurveyItem[];
};

// 홈에 보여줄 마감 임박 설문 개수
const HOME_SURVEY_COUNT = 5;

// 내 계정 종류·잔액, 그리고 내가 응답할 수 있는 마감 임박 설문 (모두 본인·대상 것만 읽힌다)
async function fetchHome(): Promise<HomeData> {
  const { data: auth } = await supabase.auth.getUser();
  const myId = auth.user?.id;

  const [{ data: profile }, { data: balance }, { data: surveys }, { data: responses }] =
    await Promise.all([
      supabase.from("profiles").select("account_type").maybeSingle(),
      supabase.rpc("get_my_balance"),
      supabase
        .from("surveys")
        .select("id, owner_id, title, est_minutes, reward_points, closes_at, survey_categories(name)")
        .eq("status", "open")
        .or(`closes_at.is.null,closes_at.gt.${new Date().toISOString()}`)
        .order("closes_at", { ascending: true, nullsFirst: false })
        .limit(30),
      supabase.from("responses").select("survey_id"),
    ]);

  // 이미 응답한 설문, 내가 올린 설문은 뺀다
  const answered = new Set((responses ?? []).map((r) => r.survey_id));
  const open = (surveys ?? [])
    .filter((s) => !answered.has(s.id) && s.owner_id !== myId)
    .slice(0, HOME_SURVEY_COUNT);

  return {
    isOrg: profile?.account_type === "org",
    balance: typeof balance === "number" ? balance : 0,
    surveys: open as unknown as SurveyItem[],
  };
}

export default function Home() {
  const [data, setData] = useState<HomeData | null>(null);

  // 탭에 돌아올 때마다 새로 불러온다 (응답 후 포인트·목록이 바로 바뀌게)
  useFocusEffect(
    useCallback(() => {
      fetchHome().then(setData);
    }, []),
  );

  if (data === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const goSurveys = () => router.navigate("/surveys");
  const goData = () => router.navigate("/data");
  // TODO(임시): 설문 등록 준비 중 안내 · 2단계(설문 작성)에서 화면 연결 · docs/PROGRESS.md
  const goCreate = () => showNotice("준비 중", "설문 등록은 곧 열려요.");

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      {/* 내 포인트 (단체는 응답·적립이 없어서 안내로 대신) */}
      <View style={styles.pointBox}>
        {data.isOrg ? (
          <Text style={styles.orgNotice}>단체 계정은 설문 등록·결과 확인용이에요.</Text>
        ) : (
          <>
            <Text style={styles.pointLabel}>내 포인트</Text>
            <Text style={styles.pointValue}>{formatPoints(data.balance)}</Text>
          </>
        )}
      </View>

      <View style={styles.actions}>
        {!data.isOrg && <PrimaryButton title="설문 참여" onPress={goSurveys} />}
        <Pressable style={styles.secondaryButton} onPress={goCreate}>
          <Text style={styles.secondaryText}>설문 등록</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={goData}>
          <Text style={styles.secondaryText}>데이터 열람</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>마감 임박 설문</Text>
      {data.surveys.length === 0 ? (
        <Text style={styles.empty}>지금 참여할 수 있는 설문이 없어요.</Text>
      ) : (
        data.surveys.map((s) => (
          // TODO(임시): 누르면 설문 탭으로 · ③에서 설문 상세로 연결 · docs/PROGRESS.md
          <Pressable key={s.id} style={styles.surveyRow} onPress={goSurveys}>
            <View style={styles.surveyMain}>
              <Text style={styles.surveyTitle} numberOfLines={1}>
                {s.title}
              </Text>
              <Text style={styles.surveyMeta}>
                {[s.survey_categories?.name, `${s.est_minutes}분`, formatTimeLeft(s.closes_at)]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
            <Text style={styles.surveyReward}>{formatPoints(s.reward_points)}</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  pointBox: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    gap: 4,
  },
  pointLabel: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  pointValue: {
    fontSize: fontSize.hero,
    fontWeight: "800",
    color: colors.text,
  },
  orgNotice: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  actions: {
    gap: spacing.sm,
  },
  secondaryButton: {
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryText: {
    fontSize: fontSize.body,
    color: colors.text,
    fontWeight: "600",
  },
  sectionTitle: {
    marginTop: spacing.md,
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
  },
  empty: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  surveyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  surveyMain: {
    flex: 1,
    gap: 4,
  },
  surveyTitle: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.text,
  },
  surveyMeta: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  surveyReward: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.primary,
  },
});
