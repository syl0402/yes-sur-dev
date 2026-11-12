// ys-180 웰컴 미션 메인 · F-210 (2026-11-12 디자인 시안 Main.dc.html)
// 파란 화면: 말풍선 → 캐릭터 → "14일 웰컴 미션" → 남은 날 → MY 미션 현황 → 미션 길 → 안내 → 오늘 하루 보지 않기
// 화면에 오면 조건을 채운 미션을 자동으로 받는다 (서버가 확인·지급, 2026-11-12 결정)
import { Image } from "expo-image";
import { Stack, router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  FadeInUp,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppIcon from "@/components/AppIcon";
import MissionComplete, { type Claimed } from "@/components/missions/MissionComplete";
import MissionRoad from "@/components/missions/MissionRoad";
import MissionSheet from "@/components/missions/MissionSheet";
import { Text } from "@/components/ui/Text";
import { missionIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { formatPoints } from "@/lib/format";
import {
  MISSION_DAYS,
  type Mission,
  type MyMissions,
  claimReadyMissions,
  doneCount,
  loadMissions,
  setMissionOffToday,
} from "@/lib/missions";
import { showConfirm } from "@/lib/confirm";
import { showNotice } from "@/lib/notice";
import { enablePush, markMissionPushAsked, shouldAskMissionPush } from "@/lib/push";
import { supabase } from "@/lib/supabase";

const CHEER = require("../../../assets/images/characters/cheer.png");

// 처음 한 번: "매일 미션 알림 받을까요?" (알림 가능한 폰 + 기기 허락 전, 2026-11-12). 화면 움직임이 끝난 뒤 묻는다
async function askMissionPush() {
  if (!(await shouldAskMissionPush())) return;
  markMissionPushAsked();
  setTimeout(() => {
    showConfirm({
      title: "매일 미션 알림 받을까요?",
      message: "저녁 7시, 오늘 미션을 아직 안 했을 때만 한 번 알려 드려요. 내 정보에서 언제든 끌 수 있어요.",
      okLabel: "받을게요",
      cancelLabel: "나중에",
      onOk: async () => {
        await supabase.rpc("set_notify_mission", { p_on: true });
        if (!(await enablePush())) {
          showNotice("알림을 받으려면 허락이 필요해요", "폰 설정 → 애플리케이션 → 옛썰 → 알림에서 허락해 주세요.");
        }
      },
    });
  }, 1500);
}

export default function Missions() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [data, setData] = useState<MyMissions | null>(null);
  const [notStudent, setNotStudent] = useState(false);
  // 상세 바텀시트로 연 미션
  const [sheet, setSheet] = useState<Mission | null>(null);
  // 방금 자동으로 받은 미션 (완료 팝업)
  const [claimed, setClaimed] = useState<Claimed[]>([]);

  const load = useCallback(async () => {
    try {
      const m = await loadMissions();
      // 조건을 채운 미션은 자동으로 받기 → 받은 게 있으면 다시 불러와서 보여 준다
      const claimed = await claimReadyMissions(m);
      if (claimed.length > 0) {
        setData(await loadMissions());
        setClaimed(claimed);
      } else {
        setData(m);
        // 완료 팝업이 없을 때만 묻는다 (겹치지 않게)
        askMissionPush();
      }
    } catch (e) {
      const msg = errorMessage(e as { message?: string });
      if ((e as { message?: string }).message?.includes("students_only")) setNotStudent(true);
      else showNotice("미션을 불러오지 못했어요", msg);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const close = () => (router.canGoBack() ? router.back() : router.replace("/home"));

  const offToday = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) setMissionOffToday(auth.user.id);
    close();
  };

  // 오늘 칸 · 지난 미완료 칸: 상세 바텀시트 → [○○하러 가기]로 그 기능 화면
  const openMission = (m: Mission) => setSheet(m);

  const done = data ? doneCount(data) : 0;
  // 시작일(11/14) 전이면 today_day가 0 이하 → "미션 시작까지 n일" (2026-11-12, point_rules mission_launch_date)
  const beforeStart = !!data && data.today_day < 1;
  const daysLeft = data ? (beforeStart ? 1 - data.today_day : Math.max(0, MISSION_DAYS - data.today_day + 1)) : MISSION_DAYS;
  const roadWidth = Math.min(width, 430) - spacing.md * 2;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, animation: "slide_from_bottom" }} />
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + spacing.lg }}>
        <View style={styles.header}>
          <View style={styles.headerSide} />
          <Text style={styles.headerTitle}>웰컴 미션</Text>
          <Pressable onPress={close} hitSlop={8} style={styles.headerSide} accessibilityLabel="닫기">
            <AppIcon name={missionIcons.close} size={26} color={colors.onPrimary} />
          </Pressable>
        </View>

        {notStudent ? (
          <Text style={styles.empty}>웰컴 미션은 학생 계정만 참여할 수 있어요.</Text>
        ) : !data ? (
          <ActivityIndicator color={colors.onPrimary} style={styles.loading} />
        ) : (
          <>
            <View style={styles.hero}>
              <Animated.View entering={ZoomIn.delay(350).duration(450)} style={styles.bubble}>
                <Text style={styles.bubbleText}>
                  14일 동안 최대 <Text style={styles.bubbleStrong}>{formatPoints(data.total)}</Text> 받을 수 있어요!
                </Text>
                <View style={styles.bubbleTail} />
              </Animated.View>
              <Bobbing>
                <View style={styles.charCircle} />
                <Image source={CHEER} style={styles.character} contentFit="contain" accessible={false} />
              </Bobbing>
              <Text style={styles.bigTitle}>
                <Text style={styles.bigTitleLime}>14일</Text> 웰컴 미션
              </Text>
              <Text style={styles.daysLeft}>
                {beforeStart ? "미션 시작까지" : "미션 종료까지"} <Text style={styles.daysLeftPill}> {daysLeft}일 </Text> 남았어요!
              </Text>
            </View>

            <Animated.View entering={FadeInUp.delay(200).duration(450)} style={styles.statusCard}>
              <Text style={styles.statusTitle}>MY 미션 현황</Text>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>받은 포인트</Text>
                <Text style={styles.statusValue}>{formatPoints(data.earned)}</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>더 받을 수 있는 포인트</Text>
                <Text style={[styles.statusValue, styles.statusBlue]}>{formatPoints(Math.max(0, data.total - data.earned))}</Text>
              </View>
              <ProgressBar pct={done / MISSION_DAYS} />
              <Text style={styles.statusCaption}>
                {MISSION_DAYS}개 중 <Text style={styles.statusCaptionStrong}>{done}개</Text> 완료 · 7일 달성 시{" "}
                <Text style={styles.statusCaptionStrong}>+{formatPoints(data.bonuses[0]?.reward ?? 0)}</Text>, 완주 시{" "}
                <Text style={styles.statusCaptionStrong}>+{formatPoints(data.bonuses[1]?.reward ?? 0)}</Text>
              </Text>
            </Animated.View>

            <View style={styles.road}>
              <MissionRoad missions={data} width={roadWidth} onOpen={openMission} />
            </View>

            <View style={styles.notes}>
              <Text style={styles.note}>· 미션은 하루에 1개씩 열려요.</Text>
              <Text style={styles.note}>· 열린 미션은 웰컴 미션 기간 안에 언제든 할 수 있어요.</Text>
              <Text style={styles.note}>· 미션을 하고 이 화면에 돌아오면 포인트가 자동으로 적립돼요.</Text>
            </View>

            <Pressable onPress={offToday} hitSlop={8} style={styles.offToday}>
              <Text style={styles.offTodayText}>오늘 하루 보지 않기</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
      <MissionSheet mission={sheet} onClose={() => setSheet(null)} />
      {data && claimed.length > 0 && <MissionComplete items={claimed} missions={data} onDone={() => setClaimed([])} />}
    </View>
  );
}

// 캐릭터 위아래 7px 둥실 (1.8초 반복)
function Bobbing({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    y.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [reduce, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[styles.charWrap, style]}>{children}</Animated.View>;
}

// 진행률: 0 → 현재값 (1초, 0.3초 뒤)
function ProgressBar({ pct }: { pct: number }) {
  const reduce = useReducedMotion();
  const w = useSharedValue(reduce ? pct : 0);
  useEffect(() => {
    w.value = reduce ? pct : withDelay(300, withTiming(pct, { duration: 1000, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
  }, [pct, reduce, w]);
  const style = useAnimatedStyle(() => ({ width: `${Math.round(w.value * 100)}%` }));
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  headerSide: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: fontSize.subtitle,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  loading: {
    marginTop: 120,
  },
  empty: {
    marginTop: 120,
    textAlign: "center",
    fontSize: fontSize.body,
    color: colors.onPrimaryMuted,
  },
  hero: {
    alignItems: "center",
    paddingTop: spacing.lg,
    paddingHorizontal: 20,
  },
  bubble: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  bubbleText: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text,
  },
  bubbleStrong: {
    fontWeight: "800",
    color: colors.primary,
  },
  bubbleTail: {
    position: "absolute",
    left: "50%",
    bottom: -6,
    marginLeft: -7,
    width: 14,
    height: 14,
    borderRadius: 2,
    backgroundColor: colors.surface,
    transform: [{ rotate: "45deg" }],
  },
  charWrap: {
    marginTop: 18,
    width: 170,
    height: 132,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  charCircle: {
    position: "absolute",
    top: 0,
    left: 22,
    width: 126,
    height: 126,
    borderRadius: 63,
    backgroundColor: colors.primaryDeco,
    opacity: 0.4,
  },
  // 응원 캐릭터 (원본 240 × 178)
  character: {
    width: 164,
    height: 122,
  },
  bigTitle: {
    marginTop: 10,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "800",
    letterSpacing: -1.5,
    color: colors.onPrimary,
    textAlign: "center",
  },
  bigTitleLime: {
    color: colors.accent,
  },
  daysLeft: {
    marginTop: 14,
    fontSize: fontSize.body,
    fontWeight: "500",
    color: colors.primarySoft,
  },
  daysLeftPill: {
    fontWeight: "800",
    color: colors.text,
    backgroundColor: colors.accent,
  },
  statusCard: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.md,
    padding: 22,
    gap: 12,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  statusLabel: {
    fontSize: fontSize.body,
    color: colors.iconStrong,
  },
  statusValue: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  statusBlue: {
    color: colors.primary,
  },
  track: {
    marginTop: spacing.xs,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    overflow: "hidden",
  },
  fill: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  statusCaption: {
    fontSize: fontSize.small,
    color: colors.iconStrong,
  },
  statusCaptionStrong: {
    fontWeight: "700",
    color: colors.text,
  },
  road: {
    marginTop: 44,
    alignSelf: "center",
  },
  notes: {
    marginTop: 20,
    marginHorizontal: spacing.lg,
    gap: 6,
  },
  note: {
    fontSize: fontSize.small,
    lineHeight: 20,
    color: colors.onPrimaryMuted,
  },
  offToday: {
    alignSelf: "center",
    marginTop: 28,
    padding: 12,
  },
  offTodayText: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.onPrimary,
    textDecorationLine: "underline",
  },
});
