// 캐릭터가 한 번 콩 뛰는 움직임 (위로 26 → 내려와서 → 작게 한 번 더). 동작 줄이기 설정이면 가만히
// 응답 완료 · 등록 완료 화면 (2026-11-14 공용으로 묶음)
import { type ReactNode, useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export default function Hop({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    const ease = Easing.out(Easing.quad);
    y.value = withDelay(
      100,
      withSequence(
        withTiming(-26, { duration: 220, easing: ease }),
        withTiming(0, { duration: 230, easing: Easing.in(Easing.quad) }),
        withTiming(-10, { duration: 180, easing: ease }),
        withTiming(0, { duration: 270, easing: Easing.in(Easing.quad) }),
      ),
    );
  }, [reduce, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
