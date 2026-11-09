// 밸런스 · 나만 그래? 결과: 한 줄 A vs B 막대 (2026-11-10 피드백)
// 왼쪽 A = 파랑, 오른쪽 B = 연두. 방금 투표했을 때만 가운데에서 양쪽으로 "커튼 열리듯" 벌어지며 비율까지 간다 (0.6초)
// 폰의 "동작 줄이기"가 켜져 있으면 움직이지 않고 바로 결과를 보여 준다
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius } from "@/constants/theme";

const DURATION = 600;

type Props = {
  labels: [string, string];
  // 0~100 정수 (두 값의 합은 100)
  pcts: [number, number];
  // 내가 고른 쪽 (0 = A, 1 = B, null = 안 고름)
  myChoice: number | null;
  // 방금 투표했을 때만 true
  animate: boolean;
};

export default function BalanceBar({ labels, pcts, myChoice, animate }: Props) {
  const reduceMotion = useReducedMotion();
  const play = animate && !reduceMotion;
  const [a, b] = pcts;
  const t = useSharedValue(play ? 0 : 1);
  // 숫자도 0에서 올라가게 (움직일 때만)
  const [shown, setShown] = useState<[number, number]>(play ? [0, 0] : pcts);

  useEffect(() => {
    if (!play) return;
    t.value = withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) });
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / DURATION);
      const e = 1 - Math.pow(1 - p, 3);
      setShown([Math.round(a * e), Math.round(b * e)]);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [play, a, b, t]);

  // 경계선 위치: 가운데(50%)에서 시작해 A 비율까지. A는 왼쪽 끝까지, B는 오른쪽 끝까지 벌어진다
  const leftStyle = useAnimatedStyle(() => {
    const edge = 50 + (a - 50) * t.value;
    const start = 50 * (1 - t.value);
    return { left: `${start}%`, width: `${Math.max(0, edge - start)}%` };
  });
  const rightStyle = useAnimatedStyle(() => {
    const edge = 50 + (a - 50) * t.value;
    const end = 50 + 50 * t.value;
    return { left: `${edge}%`, width: `${Math.max(0, end - edge)}%` };
  });

  const winner = a === b ? null : a > b ? 0 : 1;
  // 움직이지 않을 때는 늘 최신 숫자 (다시 불러와 숫자가 바뀌어도 맞게)
  const display = play ? shown : pcts;

  return (
    <View style={styles.wrap}>
      <View style={styles.sides}>
        {[0, 1].map((i) => (
          <View key={i} style={[styles.side, i === 1 && styles.sideRight]}>
            <Text style={[styles.label, myChoice === i && styles.labelMine]} numberOfLines={2}>
              {labels[i]}
              {myChoice === i ? " ✓" : ""}
            </Text>
            <Text style={[styles.pct, i === 0 ? styles.pctA : styles.pctB, winner === i && styles.pctWin]}>
              {display[i]}%
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, styles.fillA, leftStyle]} />
        <Animated.View style={[styles.fill, styles.fillB, rightStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  sides: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  side: {
    flex: 1,
    gap: 2,
  },
  sideRight: {
    alignItems: "flex-end",
  },
  label: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.textMuted,
  },
  labelMine: {
    color: colors.text,
    fontWeight: "700",
  },
  pct: {
    fontSize: fontSize.body,
    fontWeight: "700",
  },
  pctA: {
    color: colors.primary,
  },
  pctB: {
    color: colors.onAccentSoft,
  },
  pctWin: {
    fontSize: 22,
    fontWeight: "800",
  },
  track: {
    height: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
  fillA: {
    backgroundColor: colors.primary,
  },
  // 두 색 사이 얇은 흰 틈
  fillB: {
    backgroundColor: colors.accent,
    borderLeftWidth: 2,
    borderLeftColor: colors.surface,
  },
});
