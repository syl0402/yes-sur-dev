// 커뮤니티 탭 맨 위 배너 넘기기 (2026-11-10 피그마 커뮤니티 시안 140:55)
// 1장: 오늘의 질문 (매일 바뀌어서 이미지 대신 화면에서 그림. 오늘 질문이 없으면 뺀다)
// 2장~: 디자인팀 배너 이미지. 누르면 커뮤니티 안의 탭으로
// TODO(임시): 배너 이미지·연결 탭은 앱에 고정 · 운영자가 바꿀 수 있게 하려면 배너 표(DB) · 출시 후 (2026-11-10 결정)
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";

// 피그마 389 × 240
const RATIO = 240 / 389;

const MASCOT = require("../../../assets/images/mascot-cheer.png");

// 이미지 배너: 누르면 갈 탭 (커뮤니티 화면의 종류 탭 값)
export type BannerTarget = "vote" | "worldcup";

const IMAGE_BANNERS: { key: string; source: number; label: string; target: BannerTarget }[] = [
  { key: "cc", source: require("../../../assets/images/banners/cc.jpg"), label: "CC 좋다 vs 별로다", target: "vote" },
  {
    key: "school",
    source: require("../../../assets/images/banners/school.jpg"),
    label: "어디 학교가 제일 예뻐? 우리 학교 투표하러 가자",
    target: "worldcup",
  },
];

type TodayDaily = { question: string; my_choice: string | null };

type Props = {
  // 오늘의 질문 배너를 눌렀을 때
  onOpenDaily: () => void;
  // 이미지 배너를 눌렀을 때 (그 탭으로)
  onSelect: (target: BannerTarget) => void;
};

export default function CommunityBanner({ onOpenDaily, onSelect }: Props) {
  const { width } = useWindowDimensions();
  const height = Math.round(width * RATIO);
  const [daily, setDaily] = useState<TodayDaily | null>(null);
  const [page, setPage] = useState(0);

  // 탭에 돌아올 때마다 (답했는지가 바뀌니까)
  useFocusEffect(
    useCallback(() => {
      supabase.rpc("get_today_daily").then(({ data }) => setDaily((data as TodayDaily | null) ?? null));
    }, []),
  );

  const total = IMAGE_BANNERS.length + (daily ? 1 : 0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={{ height }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll}>
        {daily && (
          <Pressable onPress={onOpenDaily} style={[styles.daily, { width, height }]} accessibilityLabel="오늘의 질문">
            <View style={styles.planet} />
            <Image source={MASCOT} style={styles.dailyMascot} contentFit="contain" accessible={false} />
            <View style={styles.dailyText}>
              <Text style={styles.eyebrow}>오늘의 질문</Text>
              <Text style={styles.question} numberOfLines={3}>
                {daily.question}
              </Text>
              <View style={styles.cta}>
                <Text style={styles.ctaText}>{daily.my_choice ? "결과 보기 ›" : "답하고 포인트 받기 ›"}</Text>
              </View>
            </View>
          </Pressable>
        )}
        {IMAGE_BANNERS.map((b) => (
          <Pressable key={b.key} onPress={() => onSelect(b.target)} accessibilityLabel={b.label}>
            <Image source={b.source} style={{ width, height }} contentFit="cover" />
          </Pressable>
        ))}
      </ScrollView>
      {/* 오른쪽 아래 "1 / 3" */}
      <View style={styles.counter} pointerEvents="none">
        <Text style={styles.counterText}>
          {Math.min(page + 1, total)} / {total}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  daily: {
    overflow: "hidden",
    backgroundColor: colors.primary,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  // 오른쪽 아래 큰 원 (홈 포인트 카드와 같은 장식)
  planet: {
    position: "absolute",
    right: -60,
    bottom: -90,
    width: 220,
    height: 200,
    borderRadius: 110,
    backgroundColor: colors.onPrimaryPlanet,
  },
  // 원본 그림 비율 1264 × 848
  dailyMascot: {
    position: "absolute",
    right: -20,
    bottom: 0,
    width: 210,
    height: 141,
  },
  // 마스코트와 겹치지 않게 왼쪽 60%만
  dailyText: {
    width: "62%",
    gap: spacing.sm,
  },
  eyebrow: {
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    overflow: "hidden",
    backgroundColor: colors.accent,
    fontSize: fontSize.caption,
    fontWeight: "700",
    color: colors.onAccent,
  },
  question: {
    fontSize: fontSize.title,
    lineHeight: 30,
    fontWeight: "800",
    color: colors.onPrimary,
  },
  cta: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  ctaText: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.primary,
  },
  counter: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
  },
  counterText: {
    fontSize: fontSize.caption,
    fontWeight: "600",
    color: colors.onPrimary,
  },
});
