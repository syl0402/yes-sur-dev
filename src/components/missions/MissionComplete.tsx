// 웰컴 미션 완료 팝업 (2026-11-12 디자인 시안 Complete.dc.html · 애니메이션 Flow.dc.html)
// 캐릭터 점프 + "DAY n 완료" 도장 쾅 + "+nP 적립됐어요" 팝 + 진행률 + 내일 열리는 미션 + 확인
// 2026-11-12 폰 확인 피드백: 출렁임·찌그러짐·도장 회전이 겹쳐 흔들려 보여서 차분하게 (스프링 빼고 한 번씩만 움직임)
// 여러 개를 한 번에 받았으면 [확인]을 누를 때마다 다음 것을 보여 준다
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import AppIcon from "@/components/AppIcon";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import {
  BONUS_LABELS,
  CATEGORY_ICONS,
  type ClaimResult,
  MISSION_DAYS,
  type Mission,
  type MyMissions,
  doneCount,
  missionLabel,
} from "@/lib/missions";

const CHEER = require("../../../assets/images/characters/cheer.png");

export type Claimed = { mission: Mission; result: ClaimResult };

type Props = {
  items: Claimed[];
  // 받은 뒤 다시 불러온 미션 (진행률·내일 미션)
  missions: MyMissions;
  onDone: () => void;
};

export default function MissionComplete({ items, missions, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const item = items[index];
  if (!item) return null;

  const next = () => (index + 1 < items.length ? setIndex(index + 1) : onDone());

  const done = doneCount(missions);
  const weekBonus = missions.bonuses.find((b) => b.code === "bonus_week");
  const weekLeft = missions.missions.filter((m) => m.day <= 7 && m.status !== "done").length;
  const tomorrow = missions.missions.find((m) => m.day === missions.today_day + 1);

  return (
    <Modal visible transparent animationType="none" onRequestClose={next} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(250)} style={styles.dim}>
        {/* key: 다음 것을 보여 줄 때 움직임을 처음부터 */}
        <Animated.View key={item.mission.code} entering={FadeInDown.duration(400).easing(Easing.out(Easing.cubic))} style={styles.card}>
          <Hero day={item.mission.day} />
          <Text style={styles.title}>미션 완료!</Text>
          <PopPoints amount={item.result.reward} />

          {item.result.bonuses.map((b) => (
            <View key={b.code} style={styles.bonus}>
              <AppIcon name="gift" size={20} color={colors.pastelLimeText} />
              <Text style={styles.bonusText}>
                {BONUS_LABELS[b.code] ?? "보너스"} <Text style={styles.bonusStrong}>+{formatPoints(b.amount)}</Text>도 받았어요
              </Text>
            </View>
          ))}

          <View style={styles.progress}>
            <View style={styles.progressTop}>
              <Text style={styles.small}>웰컴 미션 진행률</Text>
              <Text style={styles.small}>
                <Text style={styles.strong}>{done}</Text> / {MISSION_DAYS}
              </Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round((done / MISSION_DAYS) * 100)}%` }]} />
            </View>
            {weekBonus && !weekBonus.done && weekLeft > 0 && (
              <Text style={styles.small}>
                {weekLeft}개만 더 하면 <Text style={styles.strong}>7일 보너스 +{formatPoints(weekBonus.reward)}</Text>
              </Text>
            )}
          </View>

          {tomorrow && (
            <>
              <Text style={styles.nextLabel}>내일 열리는 미션</Text>
              <View style={styles.next}>
                <View style={styles.nextIcon}>
                  <AppIcon name={CATEGORY_ICONS[missionLabel(tomorrow).cat] ?? "star"} size={18} color={colors.onPrimary} />
                </View>
                <View style={styles.nextMain}>
                  <Text style={styles.small}>
                    DAY {tomorrow.day} · {missionLabel(tomorrow).cat}
                  </Text>
                  <Text style={styles.nextTitle} numberOfLines={1}>
                    {tomorrow.title}
                  </Text>
                </View>
                <Text style={styles.nextReward}>+{formatPoints(tomorrow.reward)}</Text>
              </View>
            </>
          )}

          <Pressable onPress={next} style={({ pressed }) => [styles.ok, pressed && styles.pressed]}>
            <Text style={styles.okText}>{index + 1 < items.length ? "다음" : "확인"}</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// 캐릭터: 한 번 폴짝(-18px) → 사뿐히 착지. 도장: 기울어진 채 크게 떠 있다가 착지 뒤에 내려앉음
function Hero({ day }: { day: number }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  const stamp = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    y.value = withDelay(
      150,
      withSequence(
        withTiming(-18, { duration: 260, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) }),
      ),
    );
    stamp.value = withDelay(650, withTiming(1, { duration: 320, easing: Easing.out(Easing.back(1.4)) }));
  }, [reduce, y, stamp]);

  const charStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  // 1.6배·투명 → 1배·선명 (각도는 8°로 고정)
  const stampStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, stamp.value * 2),
    transform: [{ rotate: "8deg" }, { scale: 1.6 - 0.6 * stamp.value }],
  }));

  return (
    <View style={styles.hero}>
      <View style={styles.heroCircle} />
      <Animated.View style={charStyle}>
        <Image source={CHEER} style={styles.character} contentFit="contain" accessible={false} />
      </Animated.View>
      <Animated.View style={[styles.stamp, stampStyle]}>
        <Text style={styles.stampText}>DAY {day} 완료</Text>
      </Animated.View>
    </View>
  );
}

// "+nP 적립됐어요": 0.8 → 1.08 → 1 (도장 뒤)
function PopPoints({ amount }: { amount: number }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(reduce ? 1 : 0.8);
  useEffect(() => {
    if (reduce) return;
    s.value = withDelay(
      850,
      withSequence(
        withTiming(1.08, { duration: 180, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 160, easing: Easing.inOut(Easing.quad) }),
      ),
    );
  }, [reduce, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <View style={styles.pointsRow}>
      <Animated.Text style={[styles.points, style]}>+{formatPoints(amount)}</Animated.Text>
      <Text style={styles.pointsText}> 적립됐어요</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: colors.overlay,
  },
  card: {
    width: "100%",
    // 2026-11-12 폰 확인 피드백: 너무 커서 줄임 (시안 여백·크기 → 앱 확인 창 크기)
    maxWidth: 340,
    alignItems: "center",
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  hero: {
    width: 140,
    height: 104,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  heroCircle: {
    position: "absolute",
    left: 18,
    top: 2,
    width: 102,
    height: 102,
    borderRadius: 51,
    backgroundColor: colors.accentSoft,
  },
  // 응원 캐릭터 (원본 240 × 178)
  character: {
    width: 132,
    height: 98,
  },
  stamp: {
    position: "absolute",
    right: -18,
    top: -4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  stampText: {
    fontSize: fontSize.small,
    fontWeight: "800",
    color: colors.text,
  },
  title: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: colors.text,
  },
  pointsRow: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
  },
  points: {
    fontFamily: "Pretendard",
    fontSize: fontSize.body,
    fontWeight: "800",
    color: colors.primary,
  },
  pointsText: {
    fontSize: fontSize.body,
    color: colors.iconStrong,
  },
  bonus: {
    marginTop: 12,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  bonusText: {
    flex: 1,
    fontSize: fontSize.small,
    color: colors.text,
  },
  bonusStrong: {
    fontWeight: "800",
    color: colors.pastelLimeText,
  },
  progress: {
    marginTop: spacing.md,
    width: "100%",
    gap: spacing.sm,
  },
  progressTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  small: {
    fontSize: fontSize.small,
    color: colors.iconStrong,
  },
  strong: {
    fontWeight: "700",
    color: colors.text,
  },
  track: {
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
  nextLabel: {
    marginTop: spacing.md,
    alignSelf: "flex-start",
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.iconStrong,
  },
  next: {
    marginTop: spacing.sm,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
  },
  nextIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  nextMain: {
    flex: 1,
    gap: 2,
  },
  nextTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  nextReward: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.primary,
  },
  ok: {
    marginTop: spacing.md,
    width: "100%",
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  okText: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.onPrimary,
  },
});
