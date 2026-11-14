// 월드컵 결과 (2026-11-14 커뮤니티 시안 ③ Worldcup): 시상대 2·1·3 → 전체 순위(4위부터) → 그룹별 1위
// 들어올 때: 시상대가 3위→2위→1위 순서로 아래에서 솟고, 이름이 나타나고, 트로피가 톡. 그다음 순위 막대가 위에서부터 차례로 (2초 안)
// 숫자는 우승 비율 (랭킹 순서와 같은 기준). 동작 줄이기 설정이면 바로 다 보인다
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import AppIcon from "@/components/AppIcon";
import GrowBar from "@/components/ui/GrowBar";
import { Text } from "@/components/ui/Text";
import { worldcupIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import type { WorldcupResult } from "@/lib/worldcup";

// 접었을 때 보여 줄 순위 (4위부터 이만큼)
const LIST_FOLDED = 5;
// 시상대 높이 (1위 · 2위 · 3위)
const STAND_HEIGHT = [100, 70, 52];
// 시상대가 솟는 순서: 3위(0초) → 2위 → 1위
const RISE_DELAY = [500, 250, 0];
const RISE_MS = 450;
// 순위 막대 시작
const LIST_DELAY = 1100;

type Props = {
  result: WorldcupResult;
  // 이 인원 이상인 그룹만 1위를 보여 준다 (point_rules low_response_warning)
  groupMin: number;
};

export default function ResultView({ result, groupMin }: Props) {
  const reduce = useReducedMotion();
  const [all, setAll] = useState(false);
  const [first, second, third] = result.ranking;
  const rest = result.ranking.slice(3);
  const shown = all ? rest : rest.slice(0, LIST_FOLDED);
  const groups = result.groups.filter((g) => !g.hidden && (g.n ?? 0) >= groupMin && g.top);

  return (
    <View style={styles.wrap}>
      {/* 시상대: 2위 · 1위 · 3위 */}
      <View style={styles.podium}>
        {[1, 0, 2].map((rank) => {
          const r = [first, second, third][rank];
          if (!r) return <View key={rank} style={styles.col} />;
          return (
            <View key={rank} style={styles.col}>
              {rank === 0 && (
                <Animated.View entering={reduce ? undefined : ZoomIn.delay(900).duration(300)}>
                  <AppIcon name={worldcupIcons.trophy} size={28} color={colors.accent} />
                </Animated.View>
              )}
              <Animated.View
                entering={reduce ? undefined : FadeIn.delay(RISE_DELAY[rank] + 300).duration(250)}
                style={styles.label}
              >
                <Text style={[styles.standName, rank === 0 && styles.standNameFirst]} numberOfLines={2}>
                  {r.name}
                </Text>
                <Text style={styles.standRate}>우승 {r.win_rate}%</Text>
              </Animated.View>
              <Stand rank={rank} reduce={reduce} />
            </View>
          );
        })}
      </View>

      {rest.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>전체 순위</Text>
            <Text style={styles.sectionNote}>우승 비율 = 우승으로 고른 사람 비율</Text>
          </View>
          {shown.map((r, i) => (
            <View key={r.id} style={styles.row}>
              <Text style={styles.rank}>{i + 4}</Text>
              <Text style={styles.rowName} numberOfLines={1}>
                {r.name}
              </Text>
              <View style={styles.track}>
                <GrowBar pct={r.win_rate} delay={reduce ? 0 : LIST_DELAY + i * 80} style={styles.fill} />
              </View>
              <Text style={styles.pct}>{r.win_rate}%</Text>
            </View>
          ))}
          {rest.length > LIST_FOLDED && (
            <Pressable onPress={() => setAll(!all)} hitSlop={8}>
              <Text style={styles.more}>{all ? "접기" : `${result.ranking.length}위까지 모두 보기`}</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>그룹별 1위</Text>
        <View style={styles.groupBox}>
          {groups.map((g) => (
            <View key={`${g.dim}:${g.label}`} style={styles.groupRow}>
              <Text style={styles.groupLabel}>{g.label}</Text>
              <Text style={styles.groupTop} numberOfLines={1}>
                {g.top}
              </Text>
            </View>
          ))}
          <Text style={styles.groupNote}>참여자가 {groupMin}명 이상인 그룹부터 보여요</Text>
        </View>
      </View>
    </View>
  );
}

// 시상대 한 칸: 아래에서 위로 솟는다
function Stand({ rank, reduce }: { rank: number; reduce: boolean }) {
  const target = STAND_HEIGHT[rank];
  const h = useSharedValue(reduce ? target : 0);
  useEffect(() => {
    h.value = reduce
      ? target
      : withDelay(RISE_DELAY[rank], withTiming(target, { duration: RISE_MS, easing: Easing.out(Easing.back(1.4)) }));
  }, [h, rank, reduce, target]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <Animated.View style={[styles.stand, rank === 0 && styles.standFirst, style]}>
      <Text style={[styles.standNo, rank === 0 && styles.standNoFirst]}>{rank + 1}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.lg,
  },
  podium: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingTop: 22,
    paddingHorizontal: spacing.md,
    borderRadius: 24,
    backgroundColor: colors.primary,
    overflow: "hidden",
    minHeight: 220,
  },
  col: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  label: {
    alignItems: "center",
    gap: 2,
  },
  standName: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.onPrimary,
    textAlign: "center",
  },
  standNameFirst: {
    fontSize: fontSize.body,
    fontWeight: "800",
  },
  standRate: {
    fontSize: 11,
    color: colors.onPrimaryMuted,
  },
  stand: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingTop: spacing.sm,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    backgroundColor: colors.primaryStrong,
    overflow: "hidden",
  },
  standFirst: {
    backgroundColor: colors.accent,
  },
  standNo: {
    fontSize: fontSize.title,
    fontWeight: "800",
    color: colors.onPrimary,
  },
  standNoFirst: {
    color: colors.onAccent,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.body,
    fontWeight: "800",
    color: colors.text,
  },
  sectionNote: {
    flexShrink: 1,
    fontSize: fontSize.caption,
    color: colors.iconStrong,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 46,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  rank: {
    width: 20,
    fontSize: fontSize.label,
    fontWeight: "800",
    color: colors.textSubtle,
  },
  rowName: {
    width: 108,
    fontSize: fontSize.label,
    color: colors.text,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  pct: {
    width: 38,
    textAlign: "right",
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.text,
  },
  more: {
    paddingVertical: spacing.sm,
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.primary,
  },
  groupBox: {
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
  },
  groupRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  groupLabel: {
    fontSize: fontSize.label,
    color: colors.iconStrong,
  },
  groupTop: {
    flexShrink: 1,
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.text,
    textAlign: "right",
  },
  groupNote: {
    fontSize: fontSize.caption,
    color: colors.iconStrong,
  },
});
