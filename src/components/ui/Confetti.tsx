// 꽃가루 (월드컵 우승 · 가입 환영 화면, 2026-11-14 공용으로 뺌). 위에서 떨어지며 돌다가 사라진다 (1.4초)
// 동작 줄이기 설정이면 그리지 않는다. 부모 위쪽에 겹쳐 놓는다 (누르기는 막지 않음)
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/constants/theme";

// 조각: 가로 위치(%) · 색 · 늦게 시작(ms)
const PIECES = [
  { left: 12, color: colors.accent, delay: 100 },
  { left: 26, color: colors.primary, delay: 300 },
  { left: 40, color: colors.primaryMuted, delay: 200 },
  { left: 55, color: colors.accent, delay: 0 },
  { left: 68, color: colors.primary, delay: 150 },
  { left: 80, color: colors.primaryMuted, delay: 350 },
  { left: 90, color: colors.accent, delay: 250 },
];

export default function Confetti({ height = 300 }: { height?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <View style={[styles.wrap, { height }]} pointerEvents="none">
      {PIECES.map((c, i) => (
        <Piece key={i} {...c} fall={height - 80} />
      ))}
    </View>
  );
}

function Piece({ left, color, delay, fall }: { left: number; color: string; delay: number; fall: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }));
  }, [delay, t]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [{ translateY: t.value * fall }, { rotate: `${t.value * 300}deg` }],
  }));
  return <Animated.View style={[styles.piece, { left: `${left}%`, backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
  },
  piece: {
    position: "absolute",
    top: 10,
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});
