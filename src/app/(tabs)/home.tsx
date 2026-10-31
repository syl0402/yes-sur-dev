// ys-100 홈 · F-201, F-702 (2026-10-31 디자인: 포인트 카드 · 바로가기 3칸 · 오늘의 질문 · 마감 임박 설문)
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import DailyCard from "@/components/DailyCard";
import SurveyListCard from "@/components/SurveyListCard";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import SectionHeader from "@/components/ui/SectionHeader";
import { Text } from "@/components/ui/Text";
import { type IconName, homeIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { hasSeenOnboarding, markOnboardingSeen } from "@/lib/onboarding";
import { supabase } from "@/lib/supabase";
import { type SurveyCard, fetchOpenSurveys, sortSurveys } from "@/lib/surveys";

type HomeData = {
  isOrg: boolean;
  balance: number;
  // 이번 주(월요일부터, 한국 시간) 모은 포인트
  weekEarned: number;
  surveys: SurveyCard[];
};

// 홈에 보여줄 마감 임박 설문 개수
const HOME_SURVEY_COUNT = 5;

// 이번 주 월요일 0시 (한국 시간)
function weekStartKst(): string {
  const KST = 9 * 60 * 60 * 1000;
  const now = new Date(Date.now() + KST);
  const sinceMonday = (now.getUTCDay() + 6) % 7;
  const monday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - sinceMonday);
  return new Date(monday - KST).toISOString();
}

// 내 계정 종류·잔액·이번 주 적립, 그리고 내가 참여할 수 있는 마감 임박 설문 (모두 본인·대상 것만 읽힌다)
async function fetchHome(): Promise<HomeData> {
  const [{ data: profile }, { data: balance }, { data: earned }, surveys] = await Promise.all([
    supabase.from("profiles").select("account_type").maybeSingle(),
    supabase.rpc("get_my_balance"),
    supabase
      .from("point_ledger")
      .select("amount")
      .eq("status", "confirmed")
      .gt("amount", 0)
      .gte("created_at", weekStartKst()),
    fetchOpenSurveys(),
  ]);

  return {
    isOrg: profile?.account_type === "org",
    balance: typeof balance === "number" ? balance : 0,
    weekEarned: (earned ?? []).reduce((sum, r) => sum + r.amount, 0),
    surveys: sortSurveys(surveys, "closing").slice(0, HOME_SURVEY_COUNT),
  };
}

export default function Home() {
  const [data, setData] = useState<HomeData | null>(null);

  // 탭에 돌아올 때마다 새로 불러온다 (응답 후 포인트·목록이 바로 바뀌게)
  useFocusEffect(
    useCallback(() => {
      fetchHome().then(setData);
      // 학생이 이 폰에서 처음 들어왔으면 첫 사용 안내 (업데이트 후 기존 회원 포함, 한 번만)
      supabase.auth.getUser().then(({ data: auth }) => {
        const uid = auth.user?.id;
        if (!uid || hasSeenOnboarding(uid)) return;
        supabase
          .from("profiles")
          .select("account_type")
          .maybeSingle()
          .then(({ data: p }) => {
            if (p?.account_type === "student") router.push("/onboarding");
            else markOnboardingSeen(uid);
          });
      });
    }, []),
  );

  if (data === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
    >
      {/* 내 포인트 (단체는 응답·적립이 없어서 안내로 대신). 누르면 마이 탭의 포인트 내역으로 */}
      <Pressable style={styles.hero} onPress={() => router.navigate("/my")} disabled={data.isOrg}>
        {/* 오른쪽 아래 장식 고리 */}
        <View style={styles.heroRing} />
        {data.isOrg ? (
          <>
            <Text style={styles.heroLabel}>단체 계정</Text>
            <Text style={styles.heroOrg}>설문 등록·결과 확인용이에요.</Text>
          </>
        ) : (
          <>
            <View style={styles.heroTop}>
              <Text style={styles.heroLabel}>내 포인트</Text>
              <Text style={styles.heroLink}>포인트 내역 ›</Text>
            </View>
            <Text style={styles.heroValue}>{formatPoints(data.balance)}</Text>
            <View style={styles.heroWeek}>
              <AppIcon name={homeIcons.sparkle} size={14} color={colors.accent} />
              <Text style={styles.heroWeekText}>
                {data.weekEarned > 0
                  ? `이번 주 ${formatPoints(data.weekEarned)}를 모았어요`
                  : "설문에 답하고 포인트를 모아 보세요"}
              </Text>
            </View>
          </>
        )}
      </Pressable>

      {/* 바로가기 (단체는 응답하지 않으니 설문 참여 없음) */}
      <View style={styles.shortcuts}>
        {!data.isOrg && (
          <Shortcut
            icon={homeIcons.surveys}
            title="설문 참여"
            sub="답하고 적립하기"
            onPress={() => router.navigate("/surveys")}
          />
        )}
        <Shortcut
          icon={homeIcons.create}
          title="설문 등록"
          sub="의견 모으기"
          accent
          onPress={() => router.push("/create")}
        />
        <Shortcut
          icon={homeIcons.data}
          title="데이터 열람"
          sub="인사이트 찾기"
          onPress={() => router.navigate("/data")}
        />
      </View>

      {/* 오늘의 질문 (예약된 날만). 답하면 포인트가 바뀌니 홈을 다시 불러온다 */}
      <DailyCard onAnswered={() => fetchHome().then(setData)} onOpen={() => router.push("/community/daily")} />

      <SectionHeader
        title="마감 임박 설문"
        subtitle="놓치기 전에 참여해 보세요"
        actionLabel="전체 보기"
        onAction={() => router.navigate("/surveys")}
      />
      {data.surveys.length === 0 ? (
        <EmptyState title="지금 참여할 수 있는 설문이 없어요" message="새 설문이 올라오면 여기에 보여요." />
      ) : (
        data.surveys.map((s) => <SurveyListCard key={s.id} survey={s} />)
      )}
    </ScrollView>
  );
}

// 바로가기 한 칸 (아이콘 동그라미 + 이름 + 설명)
function Shortcut({
  icon,
  title,
  sub,
  accent,
  onPress,
}: {
  icon: IconName;
  title: string;
  sub: string;
  accent?: boolean;
  onPress: () => void;
}) {
  return (
    <Card style={styles.shortcut} onPress={onPress}>
      <View style={[styles.shortcutIcon, accent && styles.shortcutIconAccent]}>
        <AppIcon name={icon} size={22} color={accent ? colors.onAccentSoft : colors.primary} />
      </View>
      <Text style={styles.shortcutTitle}>{title}</Text>
      <Text style={styles.shortcutSub}>{sub}</Text>
    </Card>
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
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  hero: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    overflow: "hidden",
  },
  heroRing: {
    position: "absolute",
    right: -40,
    bottom: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 24,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroLabel: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.onPrimary,
    opacity: 0.9,
  },
  heroLink: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.onPrimary,
    opacity: 0.9,
  },
  heroValue: {
    fontSize: fontSize.hero,
    fontWeight: "800",
    color: colors.onPrimary,
  },
  heroWeek: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  heroWeekText: {
    fontSize: fontSize.small,
    color: colors.onPrimary,
    opacity: 0.9,
  },
  heroOrg: {
    fontSize: fontSize.subtitle,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  shortcuts: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  shortcut: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  shortcutIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.xs,
  },
  shortcutIconAccent: {
    backgroundColor: colors.accentSoft,
  },
  shortcutTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  shortcutSub: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
});
