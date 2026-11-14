// 탭 전환 (예: 진행 중 · 완료 · 마감). 회색 틀 안에서 고른 칸만 흰색 (2026-10-31 디자인)
// 2026-11-14 마이 탭 시안: 흰 알약이 고른 칸으로 미끄러진다 (0.25초, 동작 줄이기면 바로)
import { useEffect, useState } from "react";
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, shadow, spacing } from "@/constants/theme";

type Props<T extends string> = {
  // disabled: 고를 수 없는 칸 (흐리게, 2026-11-13 설문 등록 응답 대상)
  options: { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (value: T) => void;
};

const PAD = spacing.xs;

export default function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const reduce = useReducedMotion();
  // 칸 하나 너비 (틀 너비를 알고 나서 정해진다)
  const [cell, setCell] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useSharedValue(0);

  useEffect(() => {
    const to = index * cell;
    x.value = reduce || cell === 0 ? to : withTiming(to, { duration: 250, easing: Easing.out(Easing.cubic) });
  }, [index, cell, reduce, x]);

  const onLayout = (e: LayoutChangeEvent) => setCell((e.nativeEvent.layout.width - PAD * 2) / options.length);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {cell > 0 && <Animated.View style={[styles.pill, { width: cell }, pill]} />}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            style={[styles.item, on && cell === 0 && styles.itemOn, o.disabled && styles.itemDisabled]}
            onPress={() => onChange(o.value)}
            disabled={o.disabled}
          >
            <Text style={[styles.text, on && styles.textOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    padding: PAD,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  // 고른 칸 아래 흰 알약 (미끄러짐)
  pill: {
    position: "absolute",
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  item: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  itemDisabled: {
    opacity: 0.4,
  },
  // 너비를 재기 전(첫 그림) 잠깐만
  itemOn: {
    backgroundColor: colors.surface,
  },
  text: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.textMuted,
  },
  textOn: {
    color: colors.primary,
    fontWeight: "700",
  },
});
