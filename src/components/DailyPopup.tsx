// 홈에 들어오면 뜨는 "오늘의 질문" 팝업 (2026-11-10 디자인팀 제안: 홈 카드 대신 팝업으로 답하게)
// TODO(임시): 팝업 모양은 개발팀 임시 시안 · 디자인팀 팝업 시안이 오면 교체 · 디자인팀 시안 없음
// 뜨는 조건: 학생 · 오늘 질문 있음 · 아직 안 답함 · 이번에 앱을 켠 뒤 아직 안 띄움 · "오늘 그만 보기"를 안 누름 · 첫 사용 안내가 뜨는 날이 아님
// → 답할 때까지 앱을 켤 때마다 한 번씩 (탭을 오갈 때는 다시 안 뜸)
// 답하기·결과·포인트·알림 묻기는 DailyCard 그대로 (서버 answer_daily가 금액과 중복을 정한다)
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import DailyCard from "@/components/DailyCard";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { hasSeenOnboarding } from "@/lib/onboarding";
import { supabase } from "@/lib/supabase";

const MASCOT = require("../../assets/images/mascot-cheer.png");

// 이번에 앱을 켠 뒤 띄웠는지 (앱을 완전히 껐다 켜면 처음부터)
let shownThisLaunch = false;

// 한국 날짜 "2026-11-10"
function todayKst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// "오늘 그만 보기"를 누른 날 (계정마다, 이 폰에만). 저장 방식은 첫 사용 안내와 같은 localStorage
const key = (userId: string) => `daily_popup_off:${userId}`;

function offToday(userId: string): boolean {
  try {
    return localStorage.getItem(key(userId)) === todayKst();
  } catch {
    // 저장소를 못 읽으면 띄우지 않는다 (매번 뜨면 더 불편)
    return true;
  }
}

function setOffToday(userId: string) {
  try {
    localStorage.setItem(key(userId), todayKst());
  } catch {
    // 저장 실패는 무시 (다음에 앱을 켜면 한 번 더 뜰 뿐)
  }
}

export default function DailyPopup({ onAnswered }: { onAnswered?: () => void }) {
  const [userId, setUserId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (shownThisLaunch) return;
      let cancelled = false;
      (async () => {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid || offToday(uid)) return;
        // 첫 사용 안내가 뜨는 날은 팝업을 겹쳐 띄우지 않고 오늘은 넘긴다
        if (!hasSeenOnboarding(uid)) {
          setOffToday(uid);
          return;
        }
        const [{ data: profile }, { data: daily }] = await Promise.all([
          supabase.from("profiles").select("account_type").maybeSingle(),
          supabase.rpc("get_today_daily"),
        ]);
        const d = daily as { my_choice: string | null } | null;
        if (cancelled || shownThisLaunch || profile?.account_type !== "student" || !d || d.my_choice) return;
        shownThisLaunch = true;
        setUserId(uid);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const close = () => setUserId(null);
  const closeForToday = () => {
    if (userId) setOffToday(userId);
    close();
  };

  return (
    <Modal visible={userId !== null} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Image source={MASCOT} style={styles.mascot} contentFit="contain" accessible={false} />
          <Text style={styles.title}>오늘의 질문이 도착했어요</Text>
          <DailyCard
            bare
            onAnswered={onAnswered}
            onOpen={() => {
              close();
              router.push("/community/daily");
            }}
          />
          {/* 아래 버튼 줄: 오늘 그만 보기 | 닫기 (이벤트 팝업에서 흔한 모양) */}
          <View style={styles.footer}>
            <Pressable onPress={closeForToday} hitSlop={8} style={styles.footerButton}>
              <Text style={styles.footerMuted}>오늘 그만 보기</Text>
            </Pressable>
            <View style={styles.footerDivider} />
            <Pressable onPress={close} hitSlop={8} style={styles.footerButton}>
              <Text style={styles.footerText}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: colors.overlay,
  },
  box: {
    width: "100%",
    maxWidth: 400,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  // 원본 그림 비율 1264 × 848
  mascot: {
    alignSelf: "center",
    width: 150,
    height: 100,
  },
  title: {
    textAlign: "center",
    fontSize: fontSize.subtitle,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  // 팝업 양옆 끝까지 닿는 버튼 줄 (위에 얇은 선)
  footer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    marginHorizontal: -spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  footerDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: colors.border,
  },
  footerMuted: {
    fontSize: fontSize.body,
    fontWeight: "500",
    color: colors.textMuted,
  },
  footerText: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
});
