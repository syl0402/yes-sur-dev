// 월드컵 진행: 파랑/라임 대결 카드 2장 (2026-11-14 커뮤니티 시안 ⑤ WcPlay)
// 고르면 체크가 0.4초 보인 뒤 다음 대결로 (월드컵은 빠른 진행이 재미라 자동으로 넘어감, 실수는 "이전 선택 다시 하기")
// 위: 라운드 배지 · "n / 대결 수" · 대결 수만큼 칸으로 나눈 진행 막대
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import AppIcon from "@/components/AppIcon";
import { Text } from "@/components/ui/Text";
import { worldcupIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { type Bracket, currentPair, roundLabel } from "@/lib/worldcup";

// 고른 카드를 보여 주는 시간
const PICK_SHOW_MS = 400;
const VS_SIZE = 48;

type Props = {
  bracket: Bracket;
  onPick: (side: 0 | 1) => void;
  // 되돌릴 선택이 있으면
  onUndo?: () => void;
};

export default function MatchView({ bracket, onPick, onUndo }: Props) {
  const [a, b] = currentPair(bracket);
  const pairs = bracket.round.length / 2;
  const [picked, setPicked] = useState<0 | 1 | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 화면을 떠나면 예약해 둔 넘김을 취소
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const choose = (side: 0 | 1) => {
    if (picked !== null) return;
    setPicked(side);
    timer.current = setTimeout(() => {
      setPicked(null);
      onPick(side);
    }, PICK_SHOW_MS);
  };

  const card = (side: 0 | 1, name: string) => {
    const on = picked === side;
    const off = picked !== null && !on;
    return (
      <Pressable
        onPress={() => choose(side)}
        style={({ pressed }) => [
          styles.card,
          side === 0 ? styles.cardA : styles.cardB,
          on && styles.cardOn,
          off && styles.cardOff,
          pressed && picked === null && styles.cardPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${name} 고르기`}
      >
        {/* 모서리 장식 원 */}
        <View style={[styles.deco, side === 0 ? styles.decoA : styles.decoB]} />
        <Text style={[styles.name, side === 1 && styles.nameB]} numberOfLines={3}>
          {name}
        </Text>
        {on && (
          <Animated.View entering={ZoomIn.duration(200)} style={[styles.check, side === 1 && styles.checkB]}>
            <AppIcon name={worldcupIcons.check} size={20} color={side === 0 ? colors.onAccent : colors.onPrimary} />
          </Animated.View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <View style={styles.round}>
          <Text style={styles.roundText}>{roundLabel(bracket.round.length)}</Text>
        </View>
        {pairs > 1 && (
          <Text style={styles.count}>
            <Text style={styles.countNow}>{bracket.pair + 1}</Text> / {pairs}
          </Text>
        )}
      </View>
      {pairs > 1 && (
        <View style={styles.segments}>
          {Array.from({ length: pairs }, (_, i) => (
            <View
              key={i}
              style={[styles.segment, i < bracket.pair ? styles.segmentDone : i === bracket.pair && styles.segmentNow]}
            />
          ))}
        </View>
      )}
      <Text style={styles.guide}>더 마음에 드는 쪽을 눌러 주세요</Text>

      {/* 대결이 바뀔 때마다 살짝 나타난다 */}
      <Animated.View key={`${bracket.round.length}-${bracket.pair}`} entering={FadeIn.duration(200)} style={styles.cards}>
        {card(0, a.name)}
        {card(1, b.name)}
        <View style={styles.vs} pointerEvents="none">
          <Text style={styles.vsText}>VS</Text>
        </View>
      </Animated.View>

      {onUndo && (
        <Pressable onPress={onUndo} disabled={picked !== null} hitSlop={8} style={styles.undo}>
          <AppIcon name={worldcupIcons.undo} size={14} color={colors.iconStrong} />
          <Text style={styles.undoText}>이전 선택 다시 하기</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  round: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  roundText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.accent,
  },
  count: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.iconStrong,
  },
  countNow: {
    color: colors.text,
  },
  segments: {
    flexDirection: "row",
    gap: 3,
    marginTop: 2,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  segmentDone: {
    backgroundColor: colors.primary,
  },
  segmentNow: {
    backgroundColor: colors.primaryMuted,
  },
  guide: {
    marginTop: 6,
    fontSize: fontSize.label,
    color: colors.iconStrong,
    textAlign: "center",
  },
  cards: {
    gap: 12,
    marginTop: 6,
  },
  card: {
    height: 220,
    borderRadius: radius.sheet,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    overflow: "hidden",
  },
  cardA: {
    backgroundColor: colors.primary,
  },
  cardB: {
    backgroundColor: colors.accent,
  },
  cardPressed: {
    opacity: 0.9,
  },
  cardOn: {
    transform: [{ scale: 1.02 }],
  },
  cardOff: {
    opacity: 0.4,
    transform: [{ scale: 0.97 }],
  },
  deco: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  decoA: {
    left: -30,
    top: -40,
    backgroundColor: colors.primaryDeco,
    opacity: 0.35,
  },
  decoB: {
    right: -30,
    bottom: -40,
    backgroundColor: colors.accentRing,
    opacity: 0.8,
  },
  name: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "800",
    color: colors.onPrimary,
    textAlign: "center",
  },
  nameB: {
    color: colors.onAccent,
  },
  check: {
    position: "absolute",
    right: 16,
    top: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  checkB: {
    backgroundColor: colors.primary,
  },
  vs: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: VS_SIZE,
    height: VS_SIZE,
    marginLeft: -VS_SIZE / 2,
    marginTop: -VS_SIZE / 2,
    borderRadius: VS_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.background,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  vsText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.accent,
  },
  undo: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 6,
    paddingVertical: spacing.md,
  },
  undoText: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.iconStrong,
  },
});
