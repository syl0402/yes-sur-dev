// 커뮤니티 탭 맨 위 배너 넘기기 (2026-11-10 피그마 커뮤니티 시안 140:55)
// 1장: 오늘의 질문 (매일 바뀌어서 이미지 대신 화면에서 그림. 오늘 질문이 없으면 뺀다)
// 2장~: 디자인팀 배너 이미지. 누르면 커뮤니티 안의 탭으로
// 3초마다 다음 장으로 자동으로 넘어가고, 손으로 넘기는 동안·다른 탭에 있는 동안은 멈춘다 (2026-11-10)
// TODO(임시): 배너 이미지·연결 탭은 앱에 고정 · 운영자가 바꿀 수 있게 하려면 배너 표(DB) · 출시 후 (2026-11-10 결정)
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

import DailyBanner, { type TodayDaily } from "@/components/community/DailyBanner";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";

// 피그마 389 × 240
const RATIO = 240 / 389;
// 자동 넘김 간격
const AUTO_MS = 3000;

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
  const scrollRef = useRef<ScrollViewInstance>(null);
  // 지금 보이는 장 (자동 넘김 타이머가 읽는다)
  const pageRef = useRef(0);
  // 손으로 넘기는 중이면 자동 넘김을 멈춘다
  const [dragging, setDragging] = useState(false);
  // 커뮤니티 탭이 보일 때만 자동 넘김
  const [focused, setFocused] = useState(false);

  // 탭에 돌아올 때마다 (답했는지가 바뀌니까)
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      supabase.rpc("get_today_daily").then(({ data }) => setDaily((data as TodayDaily | null) ?? null));
      return () => setFocused(false);
    }, []),
  );

  const total = IMAGE_BANNERS.length + (daily ? 1 : 0);

  useEffect(() => {
    if (!focused || dragging || total <= 1) return;
    const timer = setInterval(() => {
      const next = (pageRef.current + 1) % total;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      pageRef.current = next;
      setPage(next);
    }, AUTO_MS);
    return () => clearInterval(timer);
  }, [focused, dragging, total, width]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    pageRef.current = p;
    setPage(p);
    setDragging(false);
  };

  return (
    <View style={{ height }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => setDragging(true)}
        onMomentumScrollEnd={onScrollEnd}
      >
        {daily && (
          <DailyBanner daily={daily} width={width} height={height} onPress={onOpenDaily} />
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
