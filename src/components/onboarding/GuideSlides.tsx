// 사용 안내 4장의 움직이는 그림 (2026-11-14 온보딩 시안 ⑧ SignupGuide). 각 장 움직임은 약 3초 안에 끝난다
// 1. 포인트: 기울어진 카드 더미 → +5P · +30P · +20P가 위 "내 포인트" 알약으로 날아가고 숫자가 올라감
// 2. 내 설문: 기울어진 폰 화면 · 응답 수 18 → 24 · "새로 온 응답"이 0.5초마다 한 줄씩
// 3. 결과: 결과 카드 · 도넛 0 → 73% · 늦게 "첫 결과 무료" 배지
// 4. 커뮤니티: 골라 줘 막대가 0.15초 간격으로 차고 · 댓글 3개가 0.6초 간격으로 올라옴 · 첫 댓글 하트가 빨갛게
// 내용은 앱을 소개하는 예시 (실제 데이터 아님). 동작 줄이기면 끝난 모습으로 바로 보인다
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ZoomIn,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import AppIcon from "@/components/AppIcon";
import GrowBar from "@/components/ui/GrowBar";
import { Text } from "@/components/ui/Text";
import { guideIcons } from "@/constants/icons";
import { colors, radius, shadow } from "@/constants/theme";
import { canDrawSvg } from "@/lib/nativeFeatures";

// 동작 줄이기면 나타나기 효과 없이
function useEnter() {
  const reduce = useReducedMotion();
  return (delay: number, kind: "down" | "fade" | "zoom" = "down") =>
    reduce ? undefined : kind === "fade" ? FadeIn.delay(delay).duration(350) : kind === "zoom" ? ZoomIn.delay(delay).duration(300) : FadeInDown.delay(delay).duration(400);
}

// 정해진 시각에 숫자 바꾸기 (예: 0.8초 뒤 1,185 → 1.6초 뒤 1,215 …). 동작 줄이기면 마지막 값
function useSteps(values: number[], times: number[]): number {
  const reduce = useReducedMotion();
  const [i, setI] = useState(reduce ? values.length - 1 : 0);
  useEffect(() => {
    if (reduce) return;
    const timers = times.map((t, k) => setTimeout(() => setI(k + 1), t));
    return () => timers.forEach(clearTimeout);
  }, [reduce, times]);
  return values[Math.min(i, values.length - 1)];
}

// ---------- 1. 포인트 ----------
const CHIP_TIMES = [700, 1500, 2300];
const CHIP_AMOUNTS = [5, 30, 20];
const POINT_TIMES = CHIP_TIMES.map((t) => t + 600);

function FlyChip({ amount, delay, left }: { amount: number; delay: number; left: number }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  const o = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    o.value = withDelay(delay, withSequence(withTiming(1, { duration: 150 }), withDelay(300, withTiming(0, { duration: 300 }))));
    y.value = withDelay(delay + 150, withTiming(-150, { duration: 600, easing: Easing.in(Easing.quad) }));
  }, [reduce, delay, o, y]);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  return (
    <Animated.View style={[styles.flyChip, { left }, style]}>
      <Text style={styles.flyChipText}>+{amount}P</Text>
    </Animated.View>
  );
}

export function PointsArt() {
  const enter = useEnter();
  const reduce = useReducedMotion();
  const points = useSteps([1180, 1185, 1215, 1235], POINT_TIMES);
  // 알약이 포인트를 받을 때마다 통통
  const bump = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    bump.value = withSequence(withTiming(1.12, { duration: 120 }), withTiming(1, { duration: 160 }));
  }, [points, reduce, bump]);
  const pill = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));

  return (
    <View style={styles.art}>
      <Animated.View style={[styles.pointPill, pill]}>
        <Text style={styles.pointPillLabel}>내 포인트</Text>
        <Text style={styles.pointPillValue}>{points.toLocaleString("ko-KR")}P</Text>
      </Animated.View>

      <View style={styles.stack}>
        <Animated.View entering={enter(0)} style={[styles.stackCard, styles.stackBack1]}>
          <Text style={styles.stackKind}>설문 · +30P</Text>
          <Text style={styles.stackTitle}>자취생 식습관 조사</Text>
        </Animated.View>
        <Animated.View entering={enter(150)} style={[styles.stackCard, styles.stackBack2]}>
          <Text style={styles.stackKind}>설문 · +20P</Text>
          <Text style={styles.stackTitle}>자취생 한 달 식비</Text>
        </Animated.View>
        <Animated.View entering={enter(300)} style={[styles.stackCard, styles.stackFront]}>
          <Text style={styles.stackKindBlue}>오늘의 질문 · +5P</Text>
          <Text style={styles.stackTitle}>아침형 vs 저녁형, 너는?</Text>
          <View style={styles.duel}>
            <View style={[styles.duelBox, styles.duelBoxOn]}>
              <Text style={styles.duelTextOn}>아침형</Text>
            </View>
            <View style={styles.duelBox}>
              <Text style={styles.duelText}>저녁형</Text>
            </View>
          </View>
        </Animated.View>
        {CHIP_AMOUNTS.map((a, i) => (
          <FlyChip key={i} amount={a} delay={CHIP_TIMES[i]} left={40 + i * 70} />
        ))}
      </View>

      <Animated.View entering={enter(3000, "fade")}>
        <Text style={styles.caption}>
          오늘 벌써 <Text style={styles.captionStrong}>+55P</Text> 모았어요
        </Text>
      </Animated.View>
    </View>
  );
}

// ---------- 2. 내 설문 ----------
const NEW_RESPONSES = [
  { who: "경영학과 21학번", when: "4분 전" },
  { who: "간호학과 22학번", when: "3분 전" },
  { who: "컴공 23학번", when: "2분 전" },
  { who: "디자인 24학번", when: "1분 전" },
  { who: "경제학과 20학번", when: "방금" },
  { who: "심리학과 22학번", when: "방금" },
];
const ROW_TIMES = NEW_RESPONSES.map((_, i) => 400 + i * 500);

export function MySurveyArt() {
  const enter = useEnter();
  const count = useSteps([18, 19, 20, 21, 22, 23, 24], ROW_TIMES);
  return (
    <View style={styles.art}>
      <View style={styles.phone}>
        <Text style={styles.phoneKind}>내 설문 · 졸업 후 진로 고민</Text>
        <View style={styles.countRow}>
          <Text style={styles.countBig}>{count}</Text>
          <Text style={styles.countOf}>/ 30명 응답</Text>
        </View>
        <View style={styles.track}>
          <GrowBar pct={(count / 30) * 100} style={styles.fillBlue} />
        </View>
        <Text style={styles.newTitle}>새로 온 응답</Text>
        {NEW_RESPONSES.map((r, i) => (
          <Animated.View key={r.who} entering={enter(ROW_TIMES[i])} style={styles.newRow}>
            <Text style={styles.newWho}>{r.who}</Text>
            <View style={styles.newWhen}>
              {r.when === "방금" && <View style={styles.blueDot} />}
              <Text style={[styles.newWhenText, r.when === "방금" && styles.newWhenNow]}>{r.when}</Text>
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

// ---------- 3. 결과 ----------
const DONUT = 92;
const STROKE = 14;
const CIRC = 2 * Math.PI * ((DONUT - STROKE) / 2);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function Donut({ pct }: { pct: number }) {
  const reduce = useReducedMotion();
  const v = useSharedValue(reduce ? pct : 0);
  useEffect(() => {
    v.value = reduce ? pct : withDelay(300, withTiming(pct, { duration: 1200, easing: Easing.out(Easing.cubic) }));
  }, [pct, reduce, v]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: CIRC * (1 - v.value / 100) }));
  if (!canDrawSvg) {
    return (
      <View style={[styles.track, { width: DONUT }]}>
        <GrowBar pct={pct} style={styles.fillBlue} />
      </View>
    );
  }
  const r = (DONUT - STROKE) / 2;
  return (
    <Svg width={DONUT} height={DONUT}>
      <Circle cx={DONUT / 2} cy={DONUT / 2} r={r} stroke={colors.surfaceMuted} strokeWidth={STROKE} fill="none" />
      <AnimatedCircle
        cx={DONUT / 2}
        cy={DONUT / 2}
        r={r}
        stroke={colors.primary}
        strokeWidth={STROKE}
        fill="none"
        strokeDasharray={`${CIRC} ${CIRC}`}
        strokeLinecap="round"
        rotation={-90}
        origin={`${DONUT / 2}, ${DONUT / 2}`}
        animatedProps={props}
      />
    </Svg>
  );
}

const DONUT_STEPS = [0, 73];
const DONUT_TIMES = [300];

export function ResultsArt() {
  const enter = useEnter();
  const pct = useSteps(DONUT_STEPS, DONUT_TIMES);
  return (
    <View style={styles.art}>
      <View style={styles.resultCard}>
        <Text style={styles.resultMeta}>대학생 1,284명 응답</Text>
        <Text style={styles.resultQ}>학기 중에 아르바이트 해요?</Text>
        <View style={styles.dimRow}>
          {["전체", "공학", "인문", "사회"].map((d) => (
            <View key={d} style={[styles.dim, d === "공학" && styles.dimOn]}>
              <Text style={[styles.dimText, d === "공학" && styles.dimTextOn]}>{d}</Text>
            </View>
          ))}
        </View>
        <View style={styles.donutRow}>
          <View>
            <Donut pct={73} />
            {canDrawSvg && (
              <View style={styles.donutCenter} pointerEvents="none">
                <Text style={styles.donutPct}>{pct}%</Text>
                <Text style={styles.donutLabel}>한다</Text>
              </View>
            )}
          </View>
          <View style={styles.details}>
            {[
              ["주 10시간 미만", "41%"],
              ["주 10~20시간", "24%"],
              ["주 20시간 이상", "8%"],
            ].map(([k, v], i) => (
              <Animated.View key={k} entering={enter(900 + i * 200, "fade")} style={styles.detailRow}>
                <Text style={styles.detailKey}>{k}</Text>
                <Text style={styles.detailValue}>{v}</Text>
              </Animated.View>
            ))}
          </View>
        </View>
        <Text style={styles.seeAlso}>이것도 많이 봤어요</Text>
        {["자취생 한 달 식비", "통학 시간"].map((t, i) => (
          <Animated.View key={t} entering={enter(1600 + i * 200, "fade")} style={styles.seeRow}>
            <Text style={styles.seeText}>{t}</Text>
            <AppIcon name={guideIcons.forward} size={14} color={colors.textSubtle} />
          </Animated.View>
        ))}
        {/* 늦게 튀어나오는 "첫 결과 무료" */}
        <Animated.View entering={enter(2300, "zoom")} style={styles.freeBadge}>
          <AppIcon name={guideIcons.unlock} size={12} color={colors.onAccent} />
          <Text style={styles.freeText}>첫 결과 무료</Text>
        </Animated.View>
      </View>
    </View>
  );
}

// ---------- 4. 커뮤니티 ----------
const PICKS = [
  { label: "삼겹살", pct: 41, mine: true },
  { label: "치킨", pct: 33 },
  { label: "마라탕", pct: 26 },
];
const COMMENTS = [
  { who: "컴공 23학번", side: "삼겹살", tone: "blue" as const, body: "종강엔 무조건 고기죠", hearts: 24 },
  { who: "경영 21학번", side: "치킨", tone: "lime" as const, body: "치킨은 배달 되잖아요 ㅋㅋ", hearts: 17 },
  { who: "간호 22학번", side: "마라탕", tone: "warm" as const, body: "마라탕도 한 표 주세요", hearts: 9 },
];

const LIKE_STEPS = [0, 1];
const LIKE_TIMES = [2600];
// 고른 쪽 배지 색
const SIDE_TONE = {
  blue: { bg: colors.primarySoft, fg: colors.primaryStrong },
  lime: { bg: colors.accentSoft, fg: colors.onAccentSoft },
  warm: { bg: colors.warningSoft, fg: colors.warning },
};

export function CommunityArt() {
  const enter = useEnter();
  // 첫 댓글 하트가 눌림 (2.6초)
  const liked = useSteps(LIKE_STEPS, LIKE_TIMES) === 1;
  return (
    <View style={styles.art}>
      <View style={styles.pickCard}>
        <Text style={styles.pickMeta}>골라 줘 · 128명 참여</Text>
        <Text style={styles.resultQ}>종강 파티 메뉴 골라 줘</Text>
        {PICKS.map((p, i) => (
          <View key={p.label} style={[styles.pickRow, p.mine && styles.pickRowMine]}>
            <View style={styles.pickFillBox}>
              <GrowBar
                pct={p.pct}
                delay={i * 150}
                style={[styles.pickFill, { backgroundColor: p.mine ? colors.primaryLight : colors.surfaceMuted }]}
              />
            </View>
            <Text style={[styles.pickLabel, p.mine && styles.pickLabelMine]}>
              {p.label}
              {p.mine ? "  · 내 선택" : ""}
            </Text>
            <Animated.Text entering={enter(600 + i * 150, "fade")} style={styles.pickPct}>
              {p.pct}%
            </Animated.Text>
          </View>
        ))}
      </View>

      {COMMENTS.map((c, i) => (
        <Animated.View key={c.who} entering={enter(900 + i * 600)} style={styles.comment}>
          <View style={styles.avatar} />
          <View style={styles.commentMain}>
            <View style={styles.commentHead}>
              <Text style={styles.commentWho}>{c.who}</Text>
              <View style={[styles.sideBadge, { backgroundColor: SIDE_TONE[c.tone].bg }]}>
                <Text style={[styles.sideText, { color: SIDE_TONE[c.tone].fg }]}>{c.side}</Text>
              </View>
            </View>
            <Text style={styles.commentBody}>{c.body}</Text>
          </View>
          <View style={styles.hearts}>
            <AppIcon
              name={i === 0 && liked ? guideIcons.heartOn : guideIcons.heart}
              size={14}
              color={i === 0 && liked ? colors.hot : colors.textSubtle}
            />
            <Text style={styles.heartCount}>{c.hearts + (i === 0 && liked ? 1 : 0)}</Text>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  art: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  caption: {
    fontSize: 15,
    color: colors.textStrong,
  },
  captionStrong: {
    fontWeight: "800",
    color: colors.onAccentSoft,
  },
  // 1. 포인트
  pointPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  pointPillLabel: {
    fontSize: 13,
    color: colors.primarySoft,
  },
  pointPillValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.onPrimary,
  },
  stack: {
    width: 260,
    height: 190,
    marginTop: 30,
  },
  stackCard: {
    position: "absolute",
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: radius.xl,
    ...shadow.card,
  },
  stackBack1: {
    top: 0,
    backgroundColor: colors.accentSoft,
    transform: [{ rotate: "-7deg" }],
  },
  stackBack2: {
    top: 18,
    backgroundColor: colors.primaryLight,
    transform: [{ rotate: "5deg" }],
  },
  stackFront: {
    top: 40,
    backgroundColor: colors.onPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stackKind: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.iconStrong,
  },
  stackKindBlue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryStrong,
  },
  stackTitle: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  duel: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  duelBox: {
    flex: 1,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  duelBoxOn: {
    backgroundColor: colors.primary,
  },
  duelText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textStrong,
  },
  duelTextOn: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  flyChip: {
    position: "absolute",
    top: 40,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  flyChipText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onAccent,
  },
  // 2. 내 설문 (기울어진 폰 화면)
  phone: {
    width: 250,
    padding: 18,
    gap: 6,
    borderRadius: 28,
    borderWidth: 6,
    borderColor: colors.text,
    backgroundColor: colors.onPrimary,
    transform: [{ rotate: "-4deg" }],
  },
  phoneKind: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryStrong,
  },
  countRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  countBig: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: "800",
    color: colors.text,
  },
  countOf: {
    fontSize: 14,
    color: colors.iconStrong,
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  fillBlue: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  newTitle: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: colors.iconStrong,
  },
  newRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  newWho: {
    fontSize: 13,
    color: colors.text,
  },
  newWhen: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  newWhenText: {
    fontSize: 12,
    color: colors.textSubtle,
  },
  newWhenNow: {
    fontWeight: "700",
    color: colors.primary,
  },
  blueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  // 3. 결과
  resultCard: {
    width: 290,
    padding: 18,
    gap: 8,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.onPrimary,
    ...shadow.card,
  },
  resultMeta: {
    fontSize: 12,
    color: colors.iconStrong,
  },
  resultQ: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  dimRow: {
    flexDirection: "row",
    gap: 6,
  },
  dim: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dimOn: {
    borderColor: colors.text,
    backgroundColor: colors.text,
  },
  dimText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textStrong,
  },
  dimTextOn: {
    color: colors.onPrimary,
  },
  donutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 4,
  },
  donutCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  donutPct: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  donutLabel: {
    fontSize: 11,
    color: colors.iconStrong,
  },
  details: {
    flex: 1,
    gap: 6,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailKey: {
    fontSize: 12,
    color: colors.iconStrong,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  seeAlso: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: colors.iconStrong,
  },
  seeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  seeText: {
    fontSize: 13,
    color: colors.text,
  },
  freeBadge: {
    position: "absolute",
    top: -12,
    right: -10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  freeText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.onAccent,
  },
  // 4. 커뮤니티
  pickCard: {
    width: 290,
    padding: 16,
    gap: 8,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.onPrimary,
    ...shadow.card,
  },
  pickMeta: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryStrong,
  },
  pickRow: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  pickRowMine: {
    borderColor: colors.primary,
  },
  pickFillBox: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  pickFill: {
    height: "100%",
  },
  pickLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  pickLabelMine: {
    fontWeight: "800",
    color: colors.primaryDeep,
  },
  pickPct: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textStrong,
  },
  comment: {
    width: 290,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
  },
  commentMain: {
    flex: 1,
    gap: 2,
  },
  commentHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  commentWho: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  sideBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  sideText: {
    fontSize: 10,
    fontWeight: "700",
  },
  commentBody: {
    fontSize: 13,
    color: colors.textStrong,
  },
  hearts: {
    alignItems: "center",
  },
  heartCount: {
    fontSize: 11,
    color: colors.iconStrong,
  },
});
