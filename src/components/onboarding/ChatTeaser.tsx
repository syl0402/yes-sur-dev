// 첫 화면 왼쪽 대화창 (2026-11-14 온보딩 시안 ①): 말풍선과 카드가 아래에서 하나씩 올라온다
// 너는 어떻게 생각해? → 설문 카드 → (라임) +30P 받았어! → 이건 어때? → 밸런스 카드 → (라임) 나는 짜장파 → 골라 줘 카드
// 13.5초 한 바퀴, 두 바퀴 돌고 멈춘다. 위·아래는 흐리게. 동작 줄이기면 중간 장면에서 멈춰 있다
// 내용은 앱을 소개하는 예시 (실제 데이터 아님)
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/ui/Text";
import { colors, radius } from "@/constants/theme";

const WIDTH = 200;
const HEIGHT = 236;
const GAP = 10;
// 한 칸 높이 (말풍선 48 · 설문 카드 96 · 밸런스·골라 줘 카드 86) → 올라가는 거리
const MSG = 48;
const SURVEY = 96;
const CARD = 86;
// 각 칸이 올라온 뒤 멈춰 있는 위치 (시안 keyframes와 같음)
const STOPS = [0, 58, 164, 222, 280, 376, 434, 530];
const LOOP_MS = 13500;
const MOVE_MS = (LOOP_MS * 0.0357) | 0; // 약 0.48초 이동
const HOLD_MS = (LOOP_MS / 7 - MOVE_MS) | 0; // 나머지는 멈춤
// 동작 줄이기: 밸런스 카드가 보이는 장면
const STILL = 280;

function Bubble({ text, mine }: { text: string; mine?: boolean }) {
  return (
    <View style={[styles.msgRow, { height: MSG }]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
        <Text style={styles.bubbleText}>{text}</Text>
      </View>
    </View>
  );
}

function SurveyCard() {
  return (
    <View style={[styles.card, { height: SURVEY }]}>
      <View style={styles.cardTop}>
        <Text style={styles.cardKindLime}>설문 · 약 3분</Text>
        <View style={styles.pointChip}>
          <Text style={styles.pointChipText}>+30P</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>자취생 식습관 조사</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: "64%" }]} />
      </View>
      <Text style={styles.cardSub}>남은 자리 12명</Text>
    </View>
  );
}

function BalanceCard() {
  return (
    <View style={[styles.card, { height: CARD }]}>
      <Text style={styles.cardKindBlue}>밸런스</Text>
      <Text style={styles.cardTitle}>짜장 vs 짬뽕</Text>
      <View style={styles.duel}>
        <View style={[styles.duelA, { width: "58%" }]}>
          <Text style={styles.duelTextA}>58%</Text>
        </View>
        <View style={styles.duelB}>
          <Text style={styles.duelTextB}>42%</Text>
        </View>
      </View>
    </View>
  );
}

function PickCard() {
  return (
    <View style={[styles.card, { height: CARD }]}>
      <Text style={styles.cardKindBlue}>골라 줘</Text>
      <Text style={styles.cardTitle}>종강 파티 메뉴?</Text>
      <View style={styles.pickRow}>
        <View style={[styles.pick, styles.pickOn]}>
          <Text style={[styles.pickText, styles.pickTextOn]}>삼겹살</Text>
        </View>
        <View style={styles.pick}>
          <Text style={styles.pickText}>치킨</Text>
        </View>
      </View>
    </View>
  );
}

// 위·아래 흐리게 (파란 바탕색 띠를 겹친다)
function Fade({ top }: { top?: boolean }) {
  const bands = [0.85, 0.6, 0.35, 0.15];
  return (
    <View pointerEvents="none" style={[styles.fade, top ? styles.fadeTop : styles.fadeBottom]}>
      {(top ? bands : [...bands].reverse()).map((o, i) => (
        <View key={i} style={[styles.fadeBand, { opacity: o }]} />
      ))}
    </View>
  );
}

export default function ChatTeaser() {
  const reduce = useReducedMotion();
  const y = useSharedValue(reduce ? -STILL : 0);

  useEffect(() => {
    if (reduce) {
      y.value = -STILL;
      return;
    }
    const ease = Easing.bezier(0.4, 0, 0.2, 1);
    // 한 바퀴: 멈춤 → 다음 위치로 이동 … → 마지막엔 처음 장면과 같은 곳(530)까지
    const steps = STOPS.slice(1).map((stop) => withDelay(HOLD_MS, withTiming(-stop, { duration: MOVE_MS, easing: ease })));
    const loop = withSequence(withTiming(0, { duration: 0 }), ...steps);
    y.value = withDelay(800, withRepeat(loop, 2, false));
  }, [reduce, y]);

  const move = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <View style={styles.wrap} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.column, move]}>
        <Bubble text="너는 어떻게 생각해?" />
        <SurveyCard />
        <Bubble text="+30P 받았어!" mine />
        <Bubble text="이건 어때?" />
        <BalanceCard />
        <Bubble text="나는 짜장파" mine />
        <PickCard />
        {/* 한 바퀴가 끝날 때 처음 장면과 이어지게 앞 두 칸을 한 번 더 */}
        <Bubble text="너는 어떻게 생각해?" />
        <SurveyCard />
      </Animated.View>
      <Fade top />
      <Fade />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: WIDTH,
    height: HEIGHT,
    overflow: "hidden",
  },
  column: {
    gap: GAP,
    paddingTop: HEIGHT,
  },
  msgRow: {
    justifyContent: "flex-end",
  },
  bubble: {
    paddingVertical: 9,
    paddingHorizontal: 13,
  },
  bubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: colors.onPrimary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 4,
  },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: colors.accent,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  card: {
    padding: 11,
    borderRadius: 14,
    backgroundColor: colors.onPrimary,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardKindLime: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.onAccentSoft,
  },
  cardKindBlue: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primaryStrong,
  },
  pointChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  pointChipText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.onAccent,
  },
  cardTitle: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },
  track: {
    marginTop: 8,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  cardSub: {
    marginTop: 4,
    fontSize: 10,
    color: colors.iconStrong,
  },
  duel: {
    marginTop: 8,
    height: 22,
    flexDirection: "row",
    borderRadius: 9,
    overflow: "hidden",
  },
  duelA: {
    justifyContent: "center",
    paddingLeft: 8,
    backgroundColor: colors.primary,
  },
  duelB: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 8,
    backgroundColor: colors.accentSoft,
  },
  duelTextA: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.onPrimary,
  },
  duelTextB: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.onAccentSoft,
  },
  pickRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 6,
  },
  pick: {
    flex: 1,
    height: 22,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  pickOn: {
    backgroundColor: colors.primarySoft,
  },
  pickText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textStrong,
  },
  pickTextOn: {
    color: colors.primaryStrong,
  },
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    height: HEIGHT * 0.18,
  },
  fadeTop: {
    top: 0,
  },
  fadeBottom: {
    bottom: 0,
  },
  fadeBand: {
    flex: 1,
    backgroundColor: colors.primary,
  },
});
