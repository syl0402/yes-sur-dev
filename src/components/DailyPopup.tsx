// 홈에 들어오면 뜨는 "오늘의 질문" 팝업 (2026-11-10 디자인팀 제안: 홈 카드 대신 팝업으로 답하게)
// TODO(임시): 팝업 모양은 개발팀 임시 시안 · 디자인팀 팝업 시안이 오면 교체 · 디자인팀 시안 없음
// 뜨는 조건: 학생 · 오늘 질문 있음 · 아직 안 답함 · 이번에 앱을 켠 뒤 아직 안 띄움 · "오늘 그만 보기"를 안 누름 · 첫 사용 안내가 뜨는 날이 아님
// → 답할 때까지 앱을 켤 때마다 한 번씩 (탭을 오갈 때는 다시 안 뜸)
// 아래쪽 "매일 낮 12시 알림 받기 ›": 알림을 받을 수 있는 폰인데 아직 안 켰을 때만. 누르면 내 정보의 알림 설정으로 이동 (2026-11-10)
// 답하기·결과·포인트·알림 묻기는 DailyCard 그대로 (서버 answer_daily가 금액과 중복을 정한다)
import { Image } from "expo-image";
import { type Href, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import DailyCard from "@/components/DailyCard";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, shadow, spacing } from "@/constants/theme";
import { uiIcons } from "@/constants/icons";
import { hasSeenOnboarding } from "@/lib/onboarding";
import { markPushAsked, pushPermission } from "@/lib/push";
import { supabase } from "@/lib/supabase";

// 알림 켜기/끄기가 있는 내 정보 화면
const ACCOUNT_HREF = "/account" as Href;

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
  // 알림 받기 줄을 보여 줄지
  const [showPush, setShowPush] = useState(false);

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
          supabase.from("profiles").select("account_type, notify_daily").maybeSingle(),
          supabase.rpc("get_today_daily"),
        ]);
        const d = daily as { my_choice: string | null } | null;
        if (cancelled || shownThisLaunch || profile?.account_type !== "student" || !d || d.my_choice) return;
        shownThisLaunch = true;
        // 알림: 받을 수 있는 폰 + (기기 허락 안 함 또는 알림 설정 꺼 둠)일 때만 줄을 보여 준다
        const perm = await pushPermission();
        if (perm !== null && !(perm === "granted" && profile.notify_daily)) {
          setShowPush(true);
          // 답한 뒤 따로 뜨는 "매일 알림 받을까요?" 창은 띄우지 않는다 (같은 걸 두 번 묻지 않게)
          markPushAsked();
        }
        setUserId(uid);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const close = () => setUserId(null);

  // 알림 설정 화면(내 정보)으로 이동
  const goPushSettings = () => {
    close();
    router.push(ACCOUNT_HREF);
  };

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
          {showPush && (
            <Pressable onPress={goPushSettings} style={({ pressed }) => [styles.push, pressed && styles.pushPressed]}>
              <AppIcon name={uiIcons.bell} size={18} color={colors.primary} />
              <Text style={styles.pushText}>매일 낮 12시, 오늘의 질문 알림 받기</Text>
              <Text style={styles.pushAction}>설정 ›</Text>
            </Pressable>
          )}
          {/* 아래 버튼: 앱 확인 창과 같은 둥근 회색 버튼 두 개 */}
          <View style={styles.footer}>
            <Pressable onPress={closeForToday} style={({ pressed }) => [styles.footerButton, pressed && styles.pushPressed]}>
              <Text style={styles.footerMuted}>오늘 그만 보기</Text>
            </Pressable>
            <Pressable onPress={close} style={({ pressed }) => [styles.footerButton, pressed && styles.pushPressed]}>
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
  // 앱 확인 창(AppDialog)과 같은 틀: 모서리 16 · 여백 24 · 옅은 그림자
  box: {
    width: "100%",
    maxWidth: 360,
    padding: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  // 원본 그림 비율 1264 × 848
  mascot: {
    alignSelf: "center",
    width: 132,
    height: 88,
  },
  title: {
    textAlign: "center",
    fontSize: fontSize.subtitle,
    fontWeight: "700",
    color: colors.text,
  },
  // 알림 받기 줄: 연파랑 바탕
  // 알림 줄: 위 얇은 선 · 종 아이콘 · 문구 · "설정 ›" (참고 시안)
  push: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  pushPressed: {
    opacity: 0.7,
  },
  pushText: {
    flex: 1,
    fontSize: fontSize.small,
    fontWeight: "500",
    color: colors.textStrong,
  },
  pushAction: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.primary,
  },
  // 팝업 양옆 끝까지 닿는 버튼 줄 (위에 얇은 선)
  footer: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  footerButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  footerMuted: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.textMuted,
  },
  footerText: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.text,
  },
});
