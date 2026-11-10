// ys-100 홈 · F-201, F-702 (2026-10-31 디자인: 포인트 카드 · 바로가기 · 오늘의 질문 · 마감 임박 설문 · 2026-11-10 피그마 홈 시안: 마스코트 카드 · 바로가기 4칸 · 빠른 탐색 · 추천 설문 · 최신 & 마감 임박)
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import DailyCard from "@/components/DailyCard";
import QuickExplore from "@/components/QuickExplore";
import SurveyMiniCard from "@/components/SurveyMiniCard";
import SurveyRowCard, { isClosingSoon } from "@/components/SurveyRowCard";
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
  // 추천 설문 (설문 탭 "추천순" 위에서부터)
  recommended: SurveyCard[];
};

// 포인트 카드 마스코트 (2026-11-10 피그마 홈 시안 145:3866 원본 그림)
const MASCOT = require("../../../assets/images/mascot-cheer.png");

// 추천 설문 가로 줄 개수
const HOME_SURVEY_COUNT = 5;
// 최신 설문 & 마감 임박: 모두 4개 중 마감 임박은 최대 2개 (2026-11-10 피그마 홈 시안)
const FRESH_COUNT = 4;
const CLOSING_MAX = 2;

// 마감 임박(24시간 안) 먼저 최대 2개 → 나머지는 최근 등록 순으로 채운다
function pickFresh(list: SurveyCard[]): SurveyCard[] {
  const closing = sortSurveys(list.filter(isClosingSoon), "closing").slice(0, CLOSING_MAX);
  const latest = sortSurveys(list, "latest").filter((s) => !closing.includes(s));
  return [...closing, ...latest].slice(0, FRESH_COUNT);
}

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
    // 홈은 "지금 참여할 설문"이라 내 설문은 뺀다
    surveys: pickFresh(surveys.filter((s) => !s.mine)),
    // 관심사 추천은 출시 후 (docs/QUESTIONS.md "관심사 기반 추천 설문"). 지금은 우리 학교 → 마감 가까운 순
    recommended: sortSurveys(surveys.filter((s) => !s.mine), "recommended").slice(0, HOME_SURVEY_COUNT),
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
      <Pressable style={styles.hero} onPress={() => router.navigate({ pathname: "/my", params: { tab: "ledger" } })} disabled={data.isOrg}>
        {/* 오른쪽 아래: 행성(큰 원) 위에 선 마스코트 (2026-11-10 피그마 홈 시안) */}
        <View style={styles.heroPlanet} />
        <Image source={MASCOT} style={styles.heroMascot} contentFit="contain" accessible={false} />
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

      {/* 바로가기 4칸 (단체는 응답하지 않으니 설문 참여 없음) */}
      <View style={styles.shortcuts}>
        {!data.isOrg && (
          <Shortcut icon={homeIcons.surveys} title="설문 참여" onPress={() => router.navigate("/surveys")} />
        )}
        <Shortcut icon={homeIcons.create} title="설문 등록" onPress={() => router.push("/create")} />
        <Shortcut icon={homeIcons.data} title="데이터 허브" onPress={() => router.navigate("/data")} />
        <Shortcut icon={homeIcons.community} title="커뮤니티" onPress={() => router.navigate("/community")} />
      </View>

      {/* 빠른 탐색: 카테고리 8칸 → 설문 탭 걸러 보기 (2026-11-10) */}
      <QuickExplore />

      {/* 추천 설문: 옆으로 넘겨 보기 (2026-11-10 피그마 홈 시안) */}
      {data.recommended.length > 0 && (
        <View>
          <SectionHeader
            title="추천 설문"
            subtitle="지금 참여하기 좋은 설문"
            actionLabel="전체 보기"
            onAction={() => router.navigate("/surveys")}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.carousel}
            contentContainerStyle={styles.carouselContent}
          >
            {data.recommended.map((s) => (
              <SurveyMiniCard key={s.id} survey={s} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* 오늘의 질문 (예약된 날만). 답하면 포인트가 바뀌니 홈을 다시 불러온다 */}
      <DailyCard onAnswered={() => fetchHome().then(setData)} onOpen={() => router.push("/community/daily")} />

      <SectionHeader
        title="최신 설문 & 마감 임박"
        subtitle="놓치기 전에 참여해 보세요"
        actionLabel="전체 보기"
        onAction={() => router.navigate("/surveys")}
      />
      {data.surveys.length === 0 ? (
        <EmptyState title="지금 참여할 수 있는 설문이 없어요" message="새 설문이 올라오면 여기에 보여요." />
      ) : (
        data.surveys.map((s) => <SurveyRowCard key={s.id} survey={s} />)
      )}
    </ScrollView>
  );
}

// 바로가기 한 칸 (꽉 찬 파란 아이콘 + 이름, 카드 없이)
function Shortcut({ icon, title, onPress }: { icon: IconName; title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.shortcut, pressed && styles.shortcutPressed]}>
      <View style={styles.shortcutIcon}>
        <AppIcon name={icon} size={26} color={colors.primary} />
      </View>
      <Text style={styles.shortcutTitle}>{title}</Text>
    </Pressable>
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
  // 피그마 358 × 217. 글자는 위·아래로 나뉘고 가운데는 비운다
  hero: {
    minHeight: 200,
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    overflow: "hidden",
  },
  heroPlanet: {
    position: "absolute",
    right: -50,
    bottom: -86,
    width: 178,
    height: 161,
    borderRadius: 90,
    backgroundColor: colors.onPrimaryPlanet,
  },
  // 원본 그림 비율 1264 × 848
  heroMascot: {
    position: "absolute",
    right: -24,
    bottom: -4,
    width: 200,
    height: 134,
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
    marginTop: "auto",
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
  // 화면 양 끝까지 넘어가게 (바깥 여백만큼 당기고 안쪽에서 다시 띄움). 그림자가 잘리지 않게 위아래 여유
  carousel: {
    marginHorizontal: -spacing.md,
    marginTop: spacing.xs,
  },
  carouselContent: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  // 아래 구분선까지 (피그마: 바로가기 밑 얇은 선)
  shortcuts: {
    flexDirection: "row",
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  shortcut: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  shortcutPressed: {
    opacity: 0.5,
  },
  shortcutIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutTitle: {
    fontSize: fontSize.small,
    fontWeight: "500",
    color: colors.primaryStrong,
  },
});
