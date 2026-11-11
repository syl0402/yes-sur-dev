// 홈 웰컴 미션 배너: 포인트 카드 아래 (2026-11-12 디자인 시안 Home.dc.html)
// 오늘 미션 남음 = 흰 카드 + TODAY(톡톡) + 흰 빛이 지나감 / 오늘 완료 = Natural 50 카드 "내일 DAY n+1이 열려요"
// 미션 기간이 아니면(완주·14일 지남·단체) 홈에서 그리지 않는다
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import AppIcon from "@/components/AppIcon";
import { Text } from "@/components/ui/Text";
import { missionIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { MISSION_DAYS, type MyMissions, doneCount, todayMission } from "@/lib/missions";

const GRAD = require("../../../assets/images/characters/study.png");

export default function WelcomeBanner({ missions }: { missions: MyMissions }) {
  const today = todayMission(missions);
  if (!today) return null;
  const todayDone = today.status === "done";
  const done = doneCount(missions);

  return (
    <Animated.View entering={FadeInUp.delay(120).duration(450)}>
      <Pressable
        onPress={() => router.push("/missions")}
        style={({ pressed }) => [styles.card, todayDone && styles.cardDone, pressed && styles.pressed]}
        accessibilityLabel={`웰컴 미션 DAY ${today.day}: ${today.title}`}
      >
        {!todayDone && <Shine />}
        <View style={styles.top}>
          <View style={styles.thumb}>
            <Image source={GRAD} style={styles.thumbImage} contentFit="contain" accessible={false} />
          </View>
          <View style={styles.main}>
            {todayDone ? (
              <>
                <Text style={styles.eyebrow}>웰컴 미션 DAY {today.day} 완료</Text>
                <Text style={styles.title} numberOfLines={1}>
                  {today.day < MISSION_DAYS ? `내일 DAY ${today.day + 1}이 열려요` : "마지막 미션까지 완료!"}
                </Text>
              </>
            ) : (
              <>
                <View style={styles.eyebrowRow}>
                  <Text style={styles.eyebrow}>웰컴 미션 DAY {today.day}</Text>
                  <TodayBadge />
                </View>
                <Text style={styles.title} numberOfLines={1}>
                  {today.title}
                </Text>
              </>
            )}
          </View>
          {!todayDone && <Text style={styles.reward}>+{formatPoints(today.reward)}</Text>}
          <AppIcon name={missionIcons.forward} size={18} color={colors.textSubtle} />
        </View>
        <View style={styles.progressRow}>
          <Progress pct={done / MISSION_DAYS} />
          <Text style={styles.count}>
            <Text style={styles.countStrong}>{done}</Text> / {MISSION_DAYS}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// TODAY 배지: 1 → 1.12 → 1 (1.2초 반복)
function TodayBadge() {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    s.value = withRepeat(
      withSequence(withTiming(1.12, { duration: 600 }), withTiming(1, { duration: 600 })),
      -1,
    );
  }, [reduce, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={[styles.badge, style]}>
      <Text style={styles.badgeText}>TODAY</Text>
    </Animated.View>
  );
}

// 흰 빛이 왼쪽 → 오른쪽으로 지나감 (2.8초 반복, 1초 뒤 시작)
function Shine() {
  const reduce = useReducedMotion();
  const [w, setW] = useState(0);
  const x = useSharedValue(-1);
  useEffect(() => {
    if (reduce || w === 0) return;
    x.value = withDelay(
      1000,
      withRepeat(
        withSequence(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 1100 })),
        -1,
      ),
    );
  }, [reduce, w, x]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -80 + (x.value + 1) / 2 * (w + 160) }, { skewX: "-20deg" }],
  }));
  if (reduce) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.shine, style]} />
    </View>
  );
}

// 진행률 0 → 현재값 (1초, 0.3초 뒤)
function Progress({ pct }: { pct: number }) {
  const reduce = useReducedMotion();
  const v = useSharedValue(reduce ? pct : 0);
  useEffect(() => {
    v.value = reduce ? pct : withDelay(300, withTiming(pct, { duration: 1000, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
  }, [pct, reduce, v]);
  const style = useAnimatedStyle(() => ({ width: `${Math.round(v.value * 100)}%` }));
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // 피그마·앱 카드와 같은 테두리 카드 (시안 18 → 앱 카드 모서리 16)
  card: {
    gap: 10,
    paddingVertical: 14,
    paddingLeft: 12,
    paddingRight: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
    boxShadow: "0px 4px 14px rgba(32, 42, 64, 0.06)",
  },
  cardDone: {
    backgroundColor: colors.surfaceSubtle,
    boxShadow: [],
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  shine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "hidden",
    backgroundColor: colors.primarySoft,
  },
  thumbImage: {
    width: 46,
    height: 42,
    marginBottom: -2,
  },
  main: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  eyebrow: {
    fontSize: fontSize.caption,
    fontWeight: "700",
    color: colors.primary,
  },
  badge: {
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.text,
  },
  title: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  reward: {
    fontSize: fontSize.body,
    fontWeight: "800",
    color: colors.primary,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: spacing.xs,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    overflow: "hidden",
  },
  fill: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  count: {
    fontSize: fontSize.caption,
    color: colors.iconStrong,
  },
  countStrong: {
    fontWeight: "700",
    color: colors.text,
  },
});
