// 탭 말풍선 (2026-11-14 온보딩 시안 ⑩): 설문 · 데이터 · 커뮤니티 · 마이 탭을 처음 열 때 한 번만 (설문은 사용자 요청으로 추가, 홈은 오늘의 질문 팝업과 겹쳐 뺌)
// 화면을 어둡게 하고 캐릭터 말풍선 한 줄 · "아무 데나 눌러서 닫기". 봤는지는 이 폰에 계정마다 기억한다
// (시안의 "카드 하나에 라임 테두리"는 화면마다 카드 위치가 달라 말풍선만 둔다)
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInUp, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";

const CHEER = require("../../../assets/images/characters/cheer.png");
// 캐릭터 그림 비율 (410 × 305)
const CHEER_RATIO = 305 / 410;

export type TipTab = "surveys" | "data" | "community" | "my";

const TIPS: Record<TipTab, { title: string; sub: string }> = {
  surveys: { title: "여기서 설문에 답하고 포인트를 모아!", sub: "짧은 설문부터 하나 해 볼래?" },
  data: { title: "여기서 다른 설문 결과를 볼 수 있어!", sub: "첫 결과 보기는 무료야" },
  community: { title: "밸런스 게임이랑 골라 줘에 한 표 던져 봐!", sub: "투표하면 포인트도 받아" },
  my: { title: "내 포인트랑 내 설문은 여기서 봐!", sub: "모은 포인트로 설문을 올릴 수 있어" },
};

const key = (userId: string, tab: TipTab) => `tab_tip_seen:${tab}:${userId}`;

function seen(userId: string, tab: TipTab): boolean {
  try {
    return localStorage.getItem(key(userId, tab)) === "1";
  } catch {
    // 저장소를 못 읽으면 띄우지 않는다 (매번 뜨면 더 불편)
    return true;
  }
}

function markSeen(userId: string, tab: TipTab) {
  try {
    localStorage.setItem(key(userId, tab), "1");
  } catch {
    // 저장 실패는 무시 (다음에 한 번 더 보일 뿐)
  }
}

export default function TabTip({ tab }: { tab: TipTab }) {
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id;
      if (id && !seen(id, tab)) setUserId(id);
    });
  }, [tab]);

  if (!userId) return null;

  const close = () => {
    markSeen(userId, tab);
    setUserId(null);
  };
  const tip = TIPS[tab];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="안내 닫기">
        <Animated.View entering={reduce ? undefined : FadeInUp.delay(150).duration(400)} style={styles.row}>
          <Image source={CHEER} style={styles.mascot} contentFit="contain" />
          <View style={styles.bubble}>
            <Text style={styles.title}>{tip.title}</Text>
            <Text style={styles.sub}>{tip.sub}</Text>
          </View>
        </Animated.View>
        <Animated.View entering={reduce ? undefined : FadeIn.delay(500).duration(400)} style={[styles.hint, { bottom: insets.bottom + 40 }]}>
          <Text style={styles.hintText}>아무 데나 눌러서 닫기</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.overlayStrong,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  mascot: {
    width: 110,
    height: 110 * CHEER_RATIO,
  },
  bubble: {
    flex: 1,
    marginBottom: 50,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    borderBottomLeftRadius: 4,
    backgroundColor: colors.onPrimary,
    gap: 2,
  },
  title: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    color: colors.text,
  },
  sub: {
    fontSize: fontSize.label,
    lineHeight: 20,
    color: colors.iconStrong,
  },
  hint: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  hintText: {
    fontSize: fontSize.label,
    color: colors.onPrimary,
  },
});
