// 웰컴 미션 길: 3칸씩 지그재그로 15칸 (14일 미션 + 완주 보상) (2026-11-12 디자인 시안 Main.dc.html)
// 칸 지름 92 · 줄 간격 160 · 길 두께 22. 칸은 차례로 톡 튀어나오고, 오늘 칸은 라임 고리가 바깥으로 퍼진다
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import AppIcon from "@/components/AppIcon";
import { Text } from "@/components/ui/Text";
import { missionIcons } from "@/constants/icons";
import { colors, fontSize, radius } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { type Mission, type MyMissions, missionLabel } from "@/lib/missions";

const NODE = 92;
const ROW = 160;
const TOP = 46;
// 시안 폭 358에서 세 칸의 가운데 x
const COLS = [64 / 358, 179 / 358, 294 / 358];

type Kind = "done" | "today" | "open" | "locked" | "bonus" | "bonusDone";

type Node = { key: string; kind: Kind; x: number; y: number; mission?: Mission; label: string; weekBonus: boolean };

function buildNodes(m: MyMissions, width: number): Node[] {
  const weekBonus = m.bonuses.find((b) => b.code === "bonus_week");
  const allBonus = m.bonuses.find((b) => b.code === "bonus_all");
  const items: (Mission | null)[] = [...m.missions, null];
  return items.map((mission, i) => {
    const row = Math.floor(i / 3);
    const k = i % 3;
    const col = row % 2 === 0 ? k : 2 - k;
    const x = width * COLS[col];
    const y = TOP + row * ROW;
    if (!mission) {
      const done = !!allBonus?.done;
      return {
        key: "bonus_all",
        kind: done ? "bonusDone" : "bonus",
        x,
        y,
        label: `+${formatPoints(allBonus?.reward ?? 0)}`,
        weekBonus: false,
      };
    }
    let kind: Kind;
    if (mission.status === "done") kind = "done";
    else if (mission.status === "locked") kind = "locked";
    else if (mission.day === m.today_day) kind = "today";
    else kind = "open";
    const label =
      kind === "done"
        ? `+${formatPoints(mission.reward)} 받음`
        : kind === "locked"
          ? `D-${mission.unlock_in}`
          : `+${formatPoints(mission.reward)}`;
    return {
      key: mission.code,
      kind,
      x,
      y,
      mission,
      label,
      // 7일차 칸 위에 "+50P 보너스" (아직 안 받았을 때)
      weekBonus: mission.day === 7 && !weekBonus?.done,
    };
  });
}

// 지그재그 길: 가로줄 → 끝에서 반원으로 꺾어 다음 줄
function roadPath(width: number, rows: number): string {
  const left = width * COLS[0];
  const right = width * COLS[2];
  let d = `M ${left} ${TOP}`;
  for (let r = 0; r < rows; r++) {
    const y = TOP + r * ROW;
    const toRight = r % 2 === 0;
    d += ` H ${toRight ? right : left}`;
    if (r < rows - 1) {
      d += ` A ${ROW / 2} ${ROW / 2} 0 0 ${toRight ? 1 : 0} ${toRight ? right : left} ${y + ROW}`;
    }
  }
  return d;
}

type Props = {
  missions: MyMissions;
  width: number;
  // 오늘 칸 · 지난 미완료 칸을 눌렀을 때
  onOpen: (m: Mission) => void;
};

export default function MissionRoad({ missions, width, onOpen }: Props) {
  const nodes = buildNodes(missions, width);
  const rows = Math.ceil(nodes.length / 3);
  const height = TOP + (rows - 1) * ROW + NODE / 2 + 40;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Path d={roadPath(width, rows)} stroke={colors.primaryStrong} strokeWidth={22} fill="none" />
      </Svg>
      {nodes.map((n, i) => (
        <Animated.View
          key={n.key}
          entering={ZoomIn.delay(700 + i * 50).duration(450)}
          style={[styles.slot, { left: n.x - 48, top: n.y - NODE / 2 }]}
        >
          <NodeView node={n} onOpen={onOpen} />
        </Animated.View>
      ))}
    </View>
  );
}

function NodeView({ node: n, onOpen }: { node: Node; onOpen: (m: Mission) => void }) {
  if (n.kind === "done" || n.kind === "bonusDone") {
    return (
      <>
        <View style={[styles.circle, styles.done]}>
          <AppIcon name={missionIcons.check} size={26} color={colors.text} />
          <Text style={styles.doneText}>{n.kind === "bonusDone" ? "완주 보상" : "미션 완료"}</Text>
        </View>
        <Text style={styles.mutedLabel}>{n.label}</Text>
      </>
    );
  }
  if (n.kind === "locked" || n.kind === "bonus") {
    return (
      <>
        <View style={[styles.circle, styles.locked]}>
          {n.kind === "bonus" ? (
            <>
              <AppIcon name={missionIcons.gift} size={28} color={colors.accent} />
              <Text style={styles.bonusText}>완주 보상</Text>
            </>
          ) : (
            <>
              <AppIcon name={missionIcons.lock} size={26} color={colors.primaryMuted} />
              <Text style={styles.lockedText}>DAY {n.mission?.day}</Text>
            </>
          )}
        </View>
        <Text style={styles.mutedLabel}>{n.label}</Text>
        {n.weekBonus && <WeekBonus />}
      </>
    );
  }
  // 오늘 · 지난 미완료: 흰 칸 (오늘은 라임 고리 + TODAY)
  const m = n.mission!;
  const label = missionLabel(m);
  const today = n.kind === "today";
  return (
    <>
      <View>
        {today && <Ring />}
        <Pressable
          onPress={() => onOpen(m)}
          accessibilityLabel={`${today ? "오늘의 미션" : `DAY ${m.day} 미션`}: ${m.title}`}
          style={({ pressed }) => [styles.circle, styles.white, today && styles.todayRing, pressed && styles.pressed]}
        >
          <Text style={styles.cat}>{label.cat}</Text>
          <Text style={styles.title}>{label.short}</Text>
        </Pressable>
        {today && (
          <View style={styles.todayBadge}>
            <Text style={styles.todayText}>TODAY</Text>
          </View>
        )}
      </View>
      <View style={styles.rewardPill}>
        <Text style={styles.rewardText}>{n.label}</Text>
      </View>
      {n.weekBonus && <WeekBonus />}
    </>
  );
}

function WeekBonus() {
  return (
    <View style={styles.weekBonus}>
      <Text style={styles.weekBonusText}>+50P 보너스</Text>
    </View>
  );
}

// 라임 고리가 바깥으로 퍼지며 사라진다 (1.6초 반복)
function Ring() {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
  }, [reduce, t]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.6 * (1 - t.value),
    transform: [{ scale: 1 + t.value * 0.28 }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.ring, style]} />;
}

const styles = StyleSheet.create({
  slot: {
    position: "absolute",
    width: 96,
    alignItems: "center",
  },
  circle: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  done: {
    backgroundColor: colors.accent,
    borderWidth: 4,
    borderColor: colors.accentRing,
  },
  doneText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    transform: [{ rotate: "-8deg" }],
  },
  locked: {
    gap: 4,
    backgroundColor: colors.primaryDeep,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.primaryDeco,
  },
  lockedText: {
    fontSize: fontSize.caption,
    fontWeight: "700",
    color: colors.onPrimaryMuted,
  },
  bonusText: {
    fontSize: fontSize.caption,
    fontWeight: "800",
    color: colors.accent,
  },
  white: {
    paddingHorizontal: 6,
    backgroundColor: colors.surface,
  },
  // 라임 테두리 5 (시안 box-shadow 0 0 0 5px)
  todayRing: {
    borderWidth: 5,
    borderColor: colors.accent,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
  ring: {
    position: "absolute",
    left: 0,
    top: 0,
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    borderWidth: 6,
    borderColor: colors.accent,
  },
  cat: {
    fontSize: 11,
    color: colors.iconStrong,
  },
  title: {
    fontSize: fontSize.small,
    lineHeight: 16,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  todayBadge: {
    position: "absolute",
    top: -14,
    alignSelf: "center",
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  todayText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.text,
  },
  mutedLabel: {
    marginTop: 8,
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.onPrimaryMuted,
  },
  rewardPill: {
    marginTop: 10,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  rewardText: {
    fontSize: fontSize.small,
    fontWeight: "800",
    color: colors.primary,
  },
  weekBonus: {
    position: "absolute",
    top: -10,
    right: -14,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    boxShadow: "0px 4px 10px rgba(10, 25, 90, 0.25)",
  },
  weekBonusText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.primary,
  },
});
