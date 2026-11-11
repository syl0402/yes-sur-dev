// 웰컴 미션 상세 바텀시트 (2026-11-12 디자인 시안 Sheet.dc.html)
// DAY·분류 배지 → 제목 → 설명 → 해 보는 방법 3단계 → 받는 포인트 → [○○하러 가기] / 나중에 할게요
// 어두운 바탕이 스르르 + 시트가 아래에서 올라온다 (250ms / 450ms)
import { Image } from "expo-image";
import { router } from "expo-router";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppIcon from "@/components/AppIcon";
import { Text } from "@/components/ui/Text";
import { homeIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { type Mission, missionGuide, missionHref, missionLabel } from "@/lib/missions";

const GRAD = require("../../../assets/images/characters/study.png");

type Props = { mission: Mission | null; onClose: () => void };

export default function MissionSheet({ mission, onClose }: Props) {
  const insets = useSafeAreaInsets();
  if (!mission) return null;
  const label = missionLabel(mission);
  const guide = missionGuide(mission);

  const go = () => {
    onClose();
    router.push(missionHref(mission));
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(250)} style={styles.dim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.duration(450).easing(Easing.bezier(0.2, 0.8, 0.2, 1))}
        style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}
      >
        <Image source={GRAD} style={styles.character} contentFit="contain" accessible={false} />
        <View style={styles.handle} />
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
        <Pressable onPress={onClose} style={styles.later}>
          <Text style={styles.laterText}>나중에 할게요</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: spacing.lg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.surface,
  },
  // 시트 위로 걸터앉은 학사모 캐릭터 (원본 240 × 218)
  character: {
    position: "absolute",
    right: 20,
    top: -62,
    width: 104,
    height: 94,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
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
  later: {
    marginTop: 6,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  laterText: {
    fontSize: 15,
    color: colors.iconStrong,
  },
});
