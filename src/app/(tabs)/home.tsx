// ys-100 홈 · F-201, F-702 (2026-10-31 디자인: 포인트 카드 · 바로가기 · 오늘의 질문 · 마감 임박 설문 · 2026-11-10 피그마 홈 시안: 마스코트 카드 · 바로가기 4칸 · 빠른 탐색 · 추천 설문 · 최신 & 마감 임박 · 인기 투표 · 오늘의 질문 팝업 · 2026-11-12 웰컴 미션 배너)
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import DailyPopup from "@/components/DailyPopup";
import HomeHotVotes from "@/components/HomeHotVotes";
import WelcomeBanner from "@/components/missions/WelcomeBanner";
import QuickExplore from "@/components/QuickExplore";
import SurveyMiniCard from "@/components/SurveyMiniCard";
import SurveyRowCard, { isClosingSoon } from "@/components/SurveyRowCard";
import EmptyState from "@/components/ui/EmptyState";
import SectionHeader from "@/components/ui/SectionHeader";
import { Text } from "@/components/ui/Text";
import { type IconName, homeIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { type MyMissions, fetchMyMissions, isMissionActive, isMissionOffToday } from "@/lib/missions";
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
  // 웰컴 미션 (학생 · 미션 기간일 때만, 아니면 null)
  missions: MyMissions | null;
};

// 이번에 앱을 켠 뒤 미션 화면을 자동으로 띄웠는지 (앱을 완전히 껐다 켜면 처음부터)
let missionShownThisLaunch = false;

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
  const [{ data: profile }, { data: balance }, { data: earned }, surveys, missions] = await Promise.all([
    supabase.from("profiles").select("account_type").maybeSingle(),
    supabase.rpc("get_my_balance"),
    supabase
      .from("point_ledger")
      .select("amount")
      .eq("status", "confirmed")
      .gt("amount", 0)
      .gte("created_at", weekStartKst()),
    fetchOpenSurveys(),
    fetchMyMissions(),
  ]);
  const isStudent = profile?.account_type === "student";

  return {
    isOrg: profile?.account_type === "org",
    balance: typeof balance === "number" ? balance : 0,
    weekEarned: (earned ?? []).reduce((sum, r) => sum + r.amount, 0),
    // 홈은 "지금 참여할 설문"이라 내 설문은 뺀다
    surveys: pickFresh(surveys.filter((s) => !s.mine)),
    // 관심사 추천은 출시 후 (docs/QUESTIONS.md "관심사 기반 추천 설문"). 지금은 우리 학교 → 마감 가까운 순
    recommended: sortSurveys(surveys.filter((s) => !s.mine), "recommended").slice(0, HOME_SURVEY_COUNT),
    missions: isStudent && isMissionActive(missions) ? missions : null,
  };
}

// 미션 기간이면 앱을 켤 때 한 번 미션 화면을 전체로 띄운다 (첫 사용 안내 다음, "오늘 하루 보지 않기"면 안 띄움)
// 이때 오늘의 질문 팝업은 띄우지 않는다 (2026-11-12 결정: 미션 기간엔 미션 화면만)
async function maybeOpenMissions(d: HomeData) {
  if (!d.missions || missionShownThisLaunch) return;
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid || !hasSeenOnboarding(uid) || isMissionOffToday(uid)) return;
  missionShownThisLaunch = true;
  router.push("/missions");
}

export default function Home() {
  const [data, setData] = useState<HomeData | null>(null);

  // 탭에 돌아올 때마다 새로 불러온다 (응답 후 포인트·목록이 바로 바뀌게)
  useFocusEffect(
    useCallback(() => {
      fetchHome().then((d) => {
        setData(d);
        maybeOpenMissions(d);
      });
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
        <View style={styles.heroShadow} />
        <Image source={MASCOT} style={styles.heroMascot} contentFit="contain" accessible={false} />
        {data.isOrg ? (
          <>
            <Text style={styles.heroLabel}>단체 계정</Text>
            <Text style={styles.heroOrg}>설문 등록·결과 확인용이에요.</Text>
          </>
        ) : (
          <>
            <Text style={styles.heroLink}>포인트 내역 ›</Text>
            <View style={styles.heroAmount}>
              <Text style={styles.heroLabel}>내 포인트</Text>
              <Text style={styles.heroValue}>{formatPoints(data.balance)}</Text>
            </View>
            {data.missions ? (
              // 웰컴 기간: 라임 "웰컴 미션으로 최대 ○P 더 받을 수 있어요 ›" (2026-11-12 디자인 시안)
              <Pressable onPress={() => router.push("/missions")} hitSlop={8} style={styles.heroWeek}>
                <Text style={styles.heroMission}>
                  웰컴 미션으로 최대 {formatPoints(Math.max(0, data.missions.total - data.missions.earned))} 더 받을 수 있어요 ›
                </Text>
              </Pressable>
            ) : (
              <View style={styles.heroWeek}>
                <AppIcon name={homeIcons.star} size={12} color={colors.accent} />
                <Text style={styles.heroWeekText}>
                  {data.weekEarned > 0
                    ? `이번 주 ${formatPoints(data.weekEarned)}를 모았어요`
                    : "설문에 답하고 포인트를 모아 보세요"}
                </Text>
              </View>
            )}
          </>
        )}
      </Pressable>

      {/* 웰컴 미션 배너 (미션 기간 학생만) */}
      {data.missions && <WelcomeBanner missions={data.missions} />}

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

      {/* 오늘의 질문: 홈 카드 대신 하루 한 번 팝업 (2026-11-10). 답하면 포인트가 바뀌니 홈을 다시 불러온다 */}
      {/* 미션 기간에는 오늘의 질문 팝업 대신 미션 화면 (2026-11-12) */}
      <DailyPopup enabled={!data.missions} onAnswered={() => fetchHome().then(setData)} />

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

      {/* 취향 밸런스 인기 투표: 커뮤니티 HOT 중 투표형 (2026-11-10) */}
      <HomeHotVotes />
    </ScrollView>
  );
}

// 바로가기 한 칸 (꽉 찬 파란 아이콘 + 이름, 카드 없이)
function Shortcut({ icon, title, onPress }: { icon: IconName; title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.shortcut, pressed && styles.shortcutPressed]}>
      <View style={styles.shortcutIcon}>
        <AppIcon name={icon} size={24} color={colors.primary} />
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
  // 포인트 카드 (2026-11-10 피그마 116:302 값): 358 × 217 · 모서리 20 · 오른쪽 위 "포인트 내역" · 왼쪽 금액 · 아래 이번 주
  hero: {
    height: 217,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    overflow: "hidden",
  },
  // 오른쪽 아래 큰 원 (흰색 38%)
  heroPlanet: {
    position: "absolute",
    right: -49,
    bottom: -86,
    width: 178,
    height: 161,
    borderRadius: 89,
    backgroundColor: colors.onPrimaryPlanet,
  },
  // 마스코트 발밑 그림자 (흰색 37% 타원 64 × 18, 살짝 기울임)
  // 납작한 상자에 둥글기를 주면 알약 모양이 되므로, 동그라미를 위아래로 눌러 진짜 타원으로 만든다 (2026-11-11)
  heroShadow: {
    position: "absolute",
    right: 21,
    bottom: 18,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.onPrimaryPlanet,
    transform: [{ rotate: "-13deg" }, { scaleY: 18 / 64 }],
  },
  // 마스코트 (피그마 151 × 110, -9.4도 기울임. 원본 그림 비율 1264 × 848)
  heroMascot: {
    position: "absolute",
    right: -14,
    bottom: 36,
    width: 164,
    height: 110,
    transform: [{ rotate: "-9.4deg" }],
  },
  heroLink: {
    alignSelf: "flex-end",
    fontSize: fontSize.small,
    fontWeight: "500",
    color: colors.onPrimary,
  },
  heroAmount: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  heroLabel: {
    fontSize: fontSize.body,
    fontWeight: "500",
    color: colors.onPrimary,
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
    gap: 6,
  },
  heroMission: {
    fontSize: fontSize.small + 1,
    fontWeight: "700",
    color: colors.accent,
  },
  heroWeekText: {
    fontSize: fontSize.small,
    fontWeight: "500",
    color: colors.onPrimary,
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
  // 바로가기 (2026-11-10 피그마 145:2877 값: 아이콘 24 · 아이콘과 이름 사이 16 · 이름 13 Blue 500)
  shortcut: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.xs,
    gap: spacing.md,
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
    color: colors.primary,
  },
});
