// 웰컴 미션 상세 바텀시트 (2026-11-12 디자인 시안 Sheet.dc.html)
// DAY·분류 배지 → 제목 → 설명 → 해 보는 방법 3단계 → 받는 포인트 → [○○하러 가기] / 나중에 할게요
// 창 자체(어두운 바탕·올라오는 움직임·손잡이)는 공용 BottomSheet (2026-11-12)
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import BottomSheet from "@/components/ui/BottomSheet";
import { Text } from "@/components/ui/Text";
import { homeIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { type Mission, missionGuide, missionHref, missionLabel } from "@/lib/missions";

const GRAD = require("../../../assets/images/characters/study.png");

type Props = { mission: Mission | null; onClose: () => void };

export default function MissionSheet({ mission, onClose }: Props) {
  if (!mission) return null;
  const label = missionLabel(mission);
  const guide = missionGuide(mission);

  const go = () => {
    onClose();
    router.push(missionHref(mission));
  };

  return (
    <BottomSheet
      onClose={onClose}
      closeLabel="나중에 할게요"
      decoration={<Image source={GRAD} style={styles.character} contentFit="contain" accessible={false} />}
    >
      <View style={styles.badges}>
        <View style={[styles.badge, styles.dayBadge]}>
          <Text style={styles.dayText}>DAY {mission.day}</Text>
        </View>
        <View style={[styles.badge, styles.catBadge]}>
          <Text style={styles.catText}>{label.cat}</Text>
        </View>
      </View>
      <Text style={styles.title}>{mission.title}</Text>
      <Text style={styles.desc}>{mission.description}</Text>

      <View style={styles.steps}>
        {guide.steps.map((s, i) => (
          <View key={i} style={styles.step}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{s}</Text>
          </View>
        ))}
      </View>

      <View style={styles.reward}>
        <View style={styles.rewardLeft}>
          <AppIcon name={homeIcons.coin} size={24} color={colors.primary} />
          <Text style={styles.rewardLabel}>완료하면 받는 포인트</Text>
        </View>
        <Text style={styles.rewardValue}>+{formatPoints(mission.reward)}</Text>
      </View>
      <Text style={styles.hint}>
        {mission.target > 1 ? `지금 ${mission.progress} / ${mission.target} · ` : ""}웰컴 미션 기간 안에 언제든 할 수 있어요.
      </Text>

      <Pressable onPress={go} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
        <Text style={styles.ctaText}>{guide.cta}</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  // 시트 위로 걸터앉은 학사모 캐릭터 (원본 240 × 218)
  character: {
    position: "absolute",
    right: 20,
    top: -62,
    width: 104,
    height: 94,
  },
  badges: {
    marginTop: 22,
    flexDirection: "row",
    gap: spacing.sm,
  },
  badge: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  dayBadge: {
    backgroundColor: colors.accent,
  },
  dayText: {
    fontSize: fontSize.caption,
    fontWeight: "800",
    color: colors.text,
  },
  catBadge: {
    backgroundColor: colors.primarySoft,
  },
  catText: {
    fontSize: fontSize.caption,
    fontWeight: "700",
    color: colors.primaryStrong,
  },
  title: {
    marginTop: 14,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: colors.text,
  },
  desc: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 24,
    color: colors.iconStrong,
  },
  steps: {
    marginTop: 22,
    padding: 18,
    gap: 14,
    borderRadius: 18,
    backgroundColor: colors.surfaceSubtle,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  stepNumText: {
    fontSize: fontSize.small,
    fontWeight: "800",
    color: colors.onPrimary,
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  reward: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  rewardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rewardLabel: {
    fontSize: 15,
    color: colors.iconStrong,
  },
  rewardValue: {
    fontSize: fontSize.subtitle,
    fontWeight: "800",
    color: colors.primary,
  },
  hint: {
    marginTop: 10,
    fontSize: fontSize.small,
    color: colors.iconStrong,
  },
  cta: {
    marginTop: spacing.lg,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.onPrimary,
  },
});
