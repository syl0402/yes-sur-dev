// ys-100 홈 · F-201, F-702
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import { colors, fontSize, spacing } from "@/constants/theme";
import { formatPoints, formatTimeLeft } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { type SurveyCard, fetchOpenSurveys, sortSurveys } from "@/lib/surveys";

type HomeData = {
  isOrg: boolean;
  balance: number;
  surveys: SurveyCard[];
};

// 홈에 보여줄 마감 임박 설문 개수
const HOME_SURVEY_COUNT = 5;

// 내 계정 종류·잔액, 그리고 내가 참여할 수 있는 마감 임박 설문 (모두 본인·대상 것만 읽힌다)
async function fetchHome(): Promise<HomeData> {
  const [{ data: profile }, { data: balance }, surveys] = await Promise.all([
    supabase.from("profiles").select("account_type").maybeSingle(),
    supabase.rpc("get_my_balance"),
    fetchOpenSurveys(),
  ]);

  return {
    isOrg: profile?.account_type === "org",
    balance: typeof balance === "number" ? balance : 0,
    surveys: sortSurveys(surveys, "closing").slice(0, HOME_SURVEY_COUNT),
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
  const goCreate = () => router.push("/create");

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
    >
      {/* 내 포인트 (단체는 응답·적립이 없어서 안내로 대신). 누르면 마이 탭의 포인트 내역으로 */}
      <Pressable style={styles.pointBox} onPress={() => router.navigate("/my")} disabled={data.isOrg}>
        {data.isOrg ? (
          <Text style={styles.orgNotice}>단체 계정은 설문 등록·결과 확인용이에요.</Text>
        ) : (
          <>
            <Text style={styles.pointLabel}>내 포인트</Text>
            <Text style={styles.pointValue}>{formatPoints(data.balance)}</Text>
          </>
        )}
      </Pressable>

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
          <Pressable
            key={s.id}
            style={styles.surveyRow}
            onPress={() => router.push({ pathname: "/survey/[id]", params: { id: String(s.id) } })}
          >
            <View style={styles.surveyMain}>
              <Text style={styles.surveyTitle} numberOfLines={1}>
                {s.title}
              </Text>
              <Text style={styles.surveyMeta}>
                {[s.category_name, `${s.est_minutes}분`, formatTimeLeft(s.closes_at)]
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
