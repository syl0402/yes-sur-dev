// 월드컵 라운드가 바뀔 때 중간 화면: "8강 진출!" · 남은 후보 · [8강 시작] (2026-11-14 커뮤니티 시안 ⑤)
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import AppIcon from "@/components/AppIcon";
import Button from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { worldcupIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { type Candidate, roundLabel } from "@/lib/worldcup";

type Props = {
  // 방금 끝난 라운드의 후보 수 (예: 16)
  from: number;
  // 다음 라운드에 올라간 후보
  winners: Candidate[];
  onStart: () => void;
  onUndo?: () => void;
};

export default function RoundBreak({ from, winners, onStart, onUndo }: Props) {
  const next = roundLabel(winners.length);
  return (
    <View style={styles.wrap}>
      <Animated.View entering={ZoomIn.duration(300)}>
        <Text style={styles.title}>{next} 진출!</Text>
      </Animated.View>
      <Text style={styles.sub}>
        {from}개 중 {winners.length}개가 남았어요
      </Text>
      <Animated.View entering={FadeIn.delay(150).duration(250)} style={styles.grid}>
        {winners.map((w) => (
          <View key={w.id} style={styles.cell}>
            <Text style={styles.cellText} numberOfLines={1}>
              {w.name}
            </Text>
          </View>
        ))}
      </Animated.View>
      <Button title={`${next} 시작`} onPress={onStart} style={styles.button} />
      {onUndo && (
        <Pressable onPress={onUndo} hitSlop={8} style={styles.undo}>
          <AppIcon name={worldcupIcons.undo} size={14} color={colors.iconStrong} />
          <Text style={styles.undoText}>이전 선택 다시 하기</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: "800",
    color: colors.primary,
  },
  sub: {
    fontSize: fontSize.label,
    color: colors.iconStrong,
  },
  grid: {
    alignSelf: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cell: {
    // 두 줄로 (가운데 간격 8의 절반씩 뺀다)
    width: "48.5%",
    height: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.onPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.text,
  },
  button: {
    alignSelf: "stretch",
    marginTop: spacing.lg,
  },
  undo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.md,
  },
  undoText: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.iconStrong,
  },
});
