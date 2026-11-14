// "🔥 HOT" 롤링 한 줄 (2026-11-03): HOT 1~5위(글·월드컵)가 3초마다 위로 넘어간다
// 누르면 그 글·월드컵으로, ▾를 누르면 HOT TOP 목록 + 학교 대항전을 펼친다. HOT이 없으면 그리지 않는다
// 목록은 커뮤니티 화면이 불러와서 넘겨준다. 폰의 "동작 줄이기"가 켜져 있으면 넘기지 않는다
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { SlideInDown, SlideOutUp, useReducedMotion } from "react-native-reanimated";

import SchoolRankingCard from "@/components/community/SchoolRankingCard";
import WeeklyBestCard from "@/components/community/WeeklyBestCard";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { type HotItem, hotHref } from "@/lib/community";

const ROLL_MS = 3000;

export default function TrendingTicker({ items }: { items: HotItem[] }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  // 3초마다 다음 항목 (펼쳤거나 동작 줄이기면 멈춤)
  useEffect(() => {
    if (items.length < 2 || open || reduceMotion) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % items.length), ROLL_MS);
    return () => clearInterval(timer);
  }, [items.length, open, reduceMotion]);

  if (items.length === 0) return null;
  const i = index % items.length;
  const item = items[i];

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <Text style={styles.title}>🔥 HOT</Text>
        <Pressable style={styles.window} onPress={() => router.push(hotHref(item))} hitSlop={6}>
          <Animated.View
            key={`${item.type}-${item.id}`}
            entering={reduceMotion ? undefined : SlideInDown.duration(350)}
            exiting={reduceMotion ? undefined : SlideOutUp.duration(350)}
            style={styles.line}
          >
            <Text style={styles.label}>{i + 1}위</Text>
            <Text style={styles.text} numberOfLines={1}>
              {item.type === "worldcup" ? "🏆 " : ""}
              {item.question}
            </Text>
          </Animated.View>
        </Pressable>
        <Pressable onPress={() => setOpen(!open)} hitSlop={10} accessibilityLabel={open ? "HOT 접기" : "HOT 펼치기"}>
          <Text style={styles.toggle}>{open ? "▴" : "▾"}</Text>
        </Pressable>
      </View>

      {open && (
        <View style={styles.panel}>
          <WeeklyBestCard items={items} />
          <SchoolRankingCard />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    // 그림자 없이 테두리만 (2026-11-14: 넓게 번지는 그림자 때문에 주변 바탕이 회색처럼 보였음)
  },
  title: {
    fontSize: fontSize.small,
    fontWeight: "800",
    color: colors.hot,
  },
  // 한 줄 창: 넘칠 때 위·아래로 사라지게 잘라 낸다
  window: {
    flex: 1,
    height: 48,
    overflow: "hidden",
    justifyContent: "center",
  },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.caption,
    fontWeight: "700",
    color: colors.textMuted,
  },
  text: {
    flex: 1,
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.text,
  },
  toggle: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  panel: {
    gap: spacing.md,
  },
});
