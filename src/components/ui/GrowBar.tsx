// 막대가 0에서 목표 길이까지 스르르 차오르는 움직임 (2026-11-14 데이터 허브 시안: 0.6초, 처음엔 빠르고 끝은 부드럽게)
// 값이 바뀌면(나눠 보기·보기 칩 변경) 새 길이로 다시 움직인다. 동작 줄이기 설정이면 바로 그 길이
// direction "width"(가로 막대) · "height"(세로 막대). style에 색·둥글기를 넘긴다
import { useEffect } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

type Props = {
  // 0~100 (%)
  pct: number;
  direction?: "width" | "height";
  style?: StyleProp<ViewStyle>;
  // 시작을 늦출 시간(ms). 여러 막대를 위에서부터 차례로 채울 때 (커뮤니티 골라 줘 0.08초 간격)
  delay?: number;
};

export default function GrowBar({ pct, direction = "width", style, delay = 0 }: Props) {
  const reduce = useReducedMotion();
  const value = useSharedValue(reduce ? pct : 0);

  useEffect(() => {
    value.value = reduce
      ? pct
      : withDelay(delay, withTiming(pct, { duration: 600, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
  }, [pct, reduce, value, delay]);

  const animated = useAnimatedStyle(() =>
    direction === "width" ? { width: `${value.value}%` } : { height: `${value.value}%` },
  );
  return <Animated.View style={[style, animated]} />;
}
