// 월드컵 우승 화면 (2026-11-14 커뮤니티 시안 ⑥ WcWin): 꽃가루 + 마스코트 점프 · "나의 우승" · 내 우승 후보
// 아래 카드: "n%가 나랑 같은 걸 우승으로 골랐어요" + 지금 순위 상위 3개 (우승 비율)
// 버튼: 전체 랭킹 보기 / 다시 하기. 동작 줄이기 설정이면 꽃가루·점프·나타나기 모두 끔
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import Button from "@/components/ui/Button";
import Confetti from "@/components/ui/Confetti";
import GrowBar from "@/components/ui/GrowBar";
import Hop from "@/components/ui/Hop";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { type Candidate, type WorldcupResult, roundLabel } from "@/lib/worldcup";

const CHEER = require("../../../assets/images/characters/cheer.png");

type Props = {
  champion: Candidate;
  title: string;
  size: number;
  // 결과 (불러오는 중이면 null)
  result: WorldcupResult | null;
  // 첫 판에 받은 포인트 (서버가 정한 값)
  reward: number;
  onRanking: () => void;
  onReplay: () => void;
};

export default function WinView({ champion, title, size, result, reward, onRanking, onReplay }: Props) {
  const same = result?.ranking.find((r) => r.id === champion.id)?.win_rate ?? null;
  const top = result?.ranking.slice(0, 3) ?? [];

  return (
    <View style={styles.wrap}>
      <Confetti />

      <Animated.View entering={ZoomIn.duration(300)} style={styles.chip}>
        <Text style={styles.chipText}>나의 우승</Text>
      </Animated.View>
      <View style={styles.hero}>
        <Animated.View entering={ZoomIn.duration(400)} style={styles.circle} />
        <Hop>
          <Image source={CHEER} style={styles.mascot} contentFit="contain" accessibilityLabel="옛썰 캐릭터" />
        </Hop>
      </View>
      <Animated.View entering={FadeInDown.delay(300).duration(300)} style={styles.names}>
        <Text style={styles.champion}>{champion.name}</Text>
        <Text style={styles.sub}>
          {title} · {roundLabel(size)}
        </Text>
        {reward > 0 && (
          <View style={styles.reward}>
            <Text style={styles.rewardText}>+{formatPoints(reward)}</Text>
          </View>
        )}
      </Animated.View>

      {result && (
        <Animated.View entering={FadeInDown.delay(550).duration(300)} style={styles.card}>
          {same !== null && (
            <Text style={styles.same}>
              <Text style={styles.sameStrong}>{same}%</Text>가 나랑 같은 걸 우승으로 골랐어요
            </Text>
          )}
          <Text style={styles.caption}>지금 순위 · 우승 비율</Text>
          {top.map((r, i) => (
            <View key={r.id} style={styles.row}>
              <Text style={[styles.rank, i === 0 && styles.rankFirst]}>{i + 1}</Text>
              <Text style={[styles.rowName, r.id === champion.id && styles.rowNameMine]} numberOfLines={1}>
                {r.name}
              </Text>
              <View style={styles.track}>
                <GrowBar
                  pct={r.win_rate}
                  delay={700 + i * 80}
                  style={[styles.fill, { backgroundColor: i === 0 ? colors.primary : colors.primaryMuted }]}
                />
              </View>
              <Text style={styles.pct}>{r.win_rate}%</Text>
            </View>
          ))}
        </Animated.View>
      )}

      <View style={styles.buttons}>
        <Button title="전체 랭킹 보기" onPress={onRanking} />
        <Button title="다시 하기" variant="outline" onPress={onReplay} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  chipText: {
    fontSize: fontSize.small,
    fontWeight: "800",
    color: colors.onAccent,
  },
  hero: {
    width: 170,
    height: 150,
    marginTop: spacing.sm,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  circle: {
    position: "absolute",
    top: 0,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primarySoft,
  },
  mascot: {
    width: 150,
    height: 140,
  },
  names: {
    alignItems: "center",
    gap: 4,
    marginTop: spacing.sm,
  },
  champion: {
    fontSize: fontSize.hero,
    lineHeight: 38,
    fontWeight: "800",
    color: colors.primary,
    textAlign: "center",
  },
  sub: {
    fontSize: fontSize.label,
    color: colors.iconStrong,
    textAlign: "center",
  },
  reward: {
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  rewardText: {
    fontSize: fontSize.body,
    fontWeight: "800",
    color: colors.onAccentSoft,
  },
  card: {
    alignSelf: "stretch",
    marginTop: spacing.md,
    padding: spacing.md,
    gap: 10,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.onPrimary,
  },
  same: {
    fontSize: fontSize.label,
    color: colors.textStrong,
  },
  sameStrong: {
    fontWeight: "800",
    color: colors.text,
  },
  caption: {
    fontSize: fontSize.caption,
    color: colors.iconStrong,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rank: {
    width: 18,
    fontSize: fontSize.small,
    fontWeight: "800",
    color: colors.textSubtle,
  },
  rankFirst: {
    color: colors.primary,
  },
  rowName: {
    width: 110,
    fontSize: fontSize.label,
    fontWeight: "500",
    color: colors.text,
  },
  rowNameMine: {
    fontWeight: "800",
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
  },
  pct: {
    width: 36,
    textAlign: "right",
    fontSize: fontSize.caption,
    color: colors.iconStrong,
  },
  buttons: {
    alignSelf: "stretch",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
