// 밸런스 줄다리기 막대 (2026-11-14 커뮤니티 시안 ① C안 · BalanceFix 1번)
// - 투표 전: 왼쪽 A(연파랑) · 오른쪽 B(연연두) 반반, 가운데 흰 VS. 각 칸을 누르면 바로 투표 (0명이어도 같은 모양)
// - 투표 후: 경계가 A 비율 위치로 이동 (0.8초, 살짝 튕기며). 화면에선 30~70%로 제한해 양쪽 글자가 보이게
//   내 편만 진한 색, 상대편은 연한 색 그대로. 숫자는 0.45초 뒤 톡 튀어나오고 VS는 남색으로 바뀌며 흔들림
// - 첫 표(참여 1명)면 내 편 100%, 막대는 72%까지만
// - lg(상세): 막대 위에 두 편 이름, 칸 안엔 큰 퍼센트 + 내 편에 "내 선택" 칩, 아래 문구 오른쪽에 참여 수
// 폰의 "동작 줄이기"가 켜져 있으면 움직이지 않고 바로 결과를 보여 준다
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { duelPcts } from "@/components/community/BalanceBar";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius } from "@/constants/theme";

const MOVE_MS = 800;
const POP_DELAY = 450;
const VS_SIZE = 30;

type Props = {
  labels: [string, string];
  // 두 편 인원. null = 아직 결과를 볼 수 없음 (투표 전)
  counts: [number, number] | null;
  // 전체 참여 수 (투표 전 0명 안내에 씀)
  votes: number;
  myChoice: number | null;
  // 투표 전일 때 칸을 누르면
  onVote?: (choice: number) => void;
  disabled?: boolean;
  // 방금 투표했을 때 / 상세에 들어왔을 때만 true → 50%에서 움직여 간다
  animate: boolean;
  // md: 피드 56px · lg: 상세 72px
  size?: "md" | "lg";
};

export default function TugBar({ labels, counts, votes, myChoice, onVote, disabled, animate, size = "md" }: Props) {
  const reduce = useReducedMotion();
  const play = animate && !reduce;
  const shown = counts !== null;
  const total = shown ? counts[0] + counts[1] : 0;
  const pcts = shown ? duelPcts(counts[0], counts[1]) : ([50, 50] as [number, number]);
  const first = shown && total === 1 && myChoice !== null;

  // 경계(A 칸 너비 %)
  const target = !shown ? 50 : first ? (myChoice === 0 ? 72 : 28) : Math.min(70, Math.max(30, pcts[0]));
  const edge = useSharedValue(play ? 50 : target);
  const tilt = useSharedValue(0);

  useEffect(() => {
    edge.value = play ? withTiming(target, { duration: MOVE_MS, easing: Easing.bezier(0.34, 1.4, 0.64, 1) }) : target;
  }, [target, play, edge]);

  const decided = shown && myChoice !== null;
  useEffect(() => {
    if (!decided || !play) return;
    tilt.value = withDelay(
      POP_DELAY,
      withSequence(
        withTiming(-14, { duration: 70 }),
        withTiming(12, { duration: 90 }),
        withTiming(-8, { duration: 80 }),
        withTiming(0, { duration: 70 }),
      ),
    );
  }, [decided, play, tilt]);

  const aStyle = useAnimatedStyle(() => ({ width: `${edge.value}%` }));
  const bStyle = useAnimatedStyle(() => ({ left: `${edge.value}%` }));
  const vsStyle = useAnimatedStyle(() => ({ left: `${edge.value}%`, transform: [{ rotate: `${tilt.value}deg` }] }));

  const lg = size === "lg";
  const height = lg ? 72 : 56;
  const canVote = !shown && !!onVote;

  const half = (i: 0 | 1) => {
    const mine = myChoice === i && shown;
    const bg = mine ? (i === 0 ? colors.primary : colors.accent) : i === 0 ? colors.primarySoft : colors.accentSoft;
    const fg = mine ? (i === 0 ? colors.onPrimary : colors.onAccent) : i === 0 ? colors.primaryStrong : colors.onAccentSoft;
    const pct = first ? (myChoice === i ? 100 : 0) : pcts[i];
    const inner = (
      <View style={[styles.inner, i === 0 ? styles.innerA : styles.innerB]}>
        {shown && lg ? (
          <View style={[styles.lgRow, i === 1 && styles.lgRowB]}>
            <Animated.View entering={play ? ZoomIn.delay(POP_DELAY).duration(250) : undefined}>
              <Text style={[styles.pct, styles.pctLg, { color: fg }]}>{pct}%</Text>
            </Animated.View>
            {mine && (
              <View style={[styles.mineChip, i === 1 && styles.mineChipB]}>
                <Text style={[styles.mineChipText, i === 1 && styles.mineChipTextB]}>내 선택</Text>
              </View>
            )}
          </View>
        ) : shown ? (
          <>
            <Text style={[styles.smallLabel, { color: fg }]} numberOfLines={1}>
              {labels[i]}
            </Text>
            <Animated.View entering={play ? ZoomIn.delay(POP_DELAY).duration(250) : undefined}>
              <Text style={[styles.pct, { color: fg }]}>{pct}%</Text>
            </Animated.View>
          </>
        ) : (
          <Text style={[styles.label, { color: fg }]} numberOfLines={2}>
            {labels[i]}
          </Text>
        )}
      </View>
    );
    return (
      <Animated.View style={[styles.half, i === 0 ? aStyle : [styles.halfB, bStyle], { backgroundColor: bg }]}>
        {canVote ? (
          <Pressable
            style={({ pressed }) => [styles.fill, pressed && styles.pressed]}
            onPress={() => onVote?.(i)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`${labels[i]} 고르기`}
          >
            {inner}
          </Pressable>
        ) : (
          inner
        )}
      </Animated.View>
    );
  };

  // 막대 아래 한 줄
  const lead = pcts[0] === pcts[1] ? null : pcts[0] > pcts[1] ? 0 : 1;
  const caption = !shown
    ? votes === 0
      ? "아직 아무도 안 골랐어요 · 첫 표를 던져 보세요"
      : null
    : first
      ? "첫 번째로 편을 정했어요!"
      : lead === null
        ? "두 편이 팽팽해요"
        : `${labels[lead]}파가 ${Math.abs(pcts[0] - pcts[1])}%p 앞서는 중`;

  return (
    <View style={styles.wrap}>
      {lg && (
        <View style={styles.sides}>
          <Text style={[styles.sideName, styles.sideA]} numberOfLines={1}>
            {labels[0]}
          </Text>
          <Text style={[styles.sideName, styles.sideB]} numberOfLines={1}>
            {labels[1]}
          </Text>
        </View>
      )}
      <View style={{ height }}>
        <View style={[styles.track, { height }]}>
          {half(0)}
          {half(1)}
        </View>
        <Animated.View pointerEvents="none" style={[styles.vs, { top: (height - VS_SIZE) / 2 }, decided && styles.vsOn, vsStyle]}>
          <Text style={[styles.vsText, decided && styles.vsTextOn]}>VS</Text>
        </Animated.View>
      </View>
      {lg ? (
        <View style={styles.captionRow}>
          <Text style={[styles.caption, styles.captionLg]} numberOfLines={1}>
            {caption ?? ""}
          </Text>
          <Text style={styles.caption}>{votes}명 참여</Text>
        </View>
      ) : (
        caption && (
          <Text style={styles.caption} numberOfLines={1}>
            {caption}
          </Text>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  track: {
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  half: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
  },
  // 두 칸 사이 얇은 흰 틈
  halfB: {
    right: 0,
    borderLeftWidth: 2,
    borderLeftColor: colors.surface,
  },
  fill: {
    flex: 1,
  },
  pressed: {
    opacity: 0.75,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    gap: 1,
  },
  // 가운데 VS에 글자가 가리지 않게 안쪽 여백을 더 준다
  innerA: {
    alignItems: "flex-start",
    paddingLeft: 14,
    paddingRight: VS_SIZE / 2 + 8,
  },
  innerB: {
    alignItems: "flex-end",
    paddingRight: 14,
    paddingLeft: VS_SIZE / 2 + 8,
  },
  label: {
    fontSize: fontSize.label,
    lineHeight: 19,
    fontWeight: "700",
  },
  smallLabel: {
    fontSize: fontSize.caption,
    lineHeight: 16,
    fontWeight: "600",
  },
  pct: {
    fontSize: fontSize.subtitle,
    lineHeight: 22,
    fontWeight: "800",
  },
  pctLg: {
    fontSize: fontSize.title,
    lineHeight: 28,
  },
  vs: {
    position: "absolute",
    width: VS_SIZE,
    height: VS_SIZE,
    marginLeft: -VS_SIZE / 2,
    borderRadius: VS_SIZE / 2,
    backgroundColor: colors.onPrimary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  vsOn: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  vsText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.text,
  },
  vsTextOn: {
    color: colors.accent,
  },
  sides: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  sideName: {
    flexShrink: 1,
    fontSize: fontSize.small,
    fontWeight: "800",
  },
  sideA: {
    color: colors.primary,
  },
  sideB: {
    color: colors.onAccentSoft,
    textAlign: "right",
  },
  lgRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lgRowB: {
    flexDirection: "row-reverse",
  },
  // 내 편 칸 안 "내 선택" (A 파랑 칸엔 라임, B 라임 칸엔 남색)
  mineChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  mineChipB: {
    backgroundColor: colors.text,
  },
  mineChipText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.onAccent,
  },
  mineChipTextB: {
    color: colors.accent,
  },
  captionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  captionLg: {
    flexShrink: 1,
    fontWeight: "800",
    color: colors.primary,
  },
  caption: {
    fontSize: fontSize.caption,
    fontWeight: "600",
    color: colors.textMuted,
  },
});
