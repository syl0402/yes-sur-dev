// ys-113 응답 완료 · F-304 (2026-10-31 디자인 → 2026-11-12 설문 흐름 시안 respond/Complete:
// 캐릭터 점프 · +nP 적립! · 내 포인트 숫자 올라감 · 보상 연락처 카드(바텀시트) · 결과 공개 안내 · 이어서 하기 좋은 설문 2개)
import { Image } from "expo-image";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInUp, ZoomIn, useReducedMotion } from "react-native-reanimated";

import AppIcon from "@/components/AppIcon";
import RewardContactForm from "@/components/RewardContactForm";
import SurveyRowCard from "@/components/SurveyRowCard";
import BottomBar from "@/components/ui/BottomBar";
import NotifySheet from "@/components/onboarding/NotifySheet";
import BottomSheet from "@/components/ui/BottomSheet";
import Button from "@/components/ui/Button";
import Hop from "@/components/ui/Hop";
import { Text } from "@/components/ui/Text";
import { uiIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { fetchSurveyReward } from "@/lib/rewards";
import { markPushAsked, shouldAskPush } from "@/lib/push";
import { supabase } from "@/lib/supabase";
import { type SurveyCard, fetchOpenSurveys, sortSurveys } from "@/lib/surveys";

const CHEER = require("../../../assets/images/characters/cheer.png");
const QUESTION = require("../../../assets/images/characters/question.png");

// 내 포인트 숫자가 올라가는 칸 수 (50ms마다 한 칸 → 약 0.6초)
const COUNT_STEPS = 12;

// 결과가 어디에 공개되는지 (비공개면 카드 없음)
const RESULT_NOTE: Record<"public" | "campus", string> = {
  public: "마감 후 데이터 허브에 결과가 공개돼요",
  campus: "마감 후 우리 학교 학생에게 결과가 공개돼요",
};

export default function SurveyDone() {
  // 받은 포인트·확인 문항 통과 여부는 제출 결과(서버가 정한 값)를 넘겨받는다
  // reason: attention(확인 문항 오답) / too_fast(너무 빨리 응답)
  const { id, reward, passed, reason } = useLocalSearchParams<{ id: string; reward: string; passed: string; reason?: string }>();
  const [balance, setBalance] = useState<number | null>(null);
  // 보상 안내 (보상 연락처를 받는 설문이면, 2026-11-07)
  const [rewardNote, setRewardNote] = useState<string | null>(null);
  // 보상 연락처를 이미 남겼는지 · 바텀시트 열림
  const [contactLeft, setContactLeft] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "campus" | "private" | null>(null);
  // 이어서 하기 좋은 설문 (지금 참여할 수 있는 것 중 추천순 2개)
  const [next, setNext] = useState<SurveyCard[]>([]);
  // 알림 허용 시트 (첫 응답 완료 때 한 번, 2026-11-14 온보딩 시안 ⑪)
  const [notifyOpen, setNotifyOpen] = useState(false);

  const surveyId = Number(id);
  const earned = Number(reward ?? 0);
  const failed = passed === "0";

  useEffect(() => {
    supabase.rpc("get_my_balance").then(({ data }) => setBalance(typeof data === "number" ? data : 0));
    fetchSurveyReward(surveyId).then(setRewardNote);
    supabase.rpc("has_my_reward_contact", { p_survey_id: surveyId }).then(({ data }) => setContactLeft(data === true));
    supabase
      .from("surveys")
      .select("result_visibility")
      .eq("id", surveyId)
      .maybeSingle()
      .then(({ data }) => setVisibility(data?.result_visibility ?? null));
    fetchOpenSurveys().then((list) =>
      setNext(
        sortSurveys(list, "recommended")
          .filter((s) => s.id !== surveyId && !s.mine)
          .slice(0, 2),
      ),
    );
  }, [surveyId]);

  // 아직 알림을 정하지 않은 폰이면 1.2초 뒤 한 번만 묻는다 (응답 실패 화면에서는 묻지 않음)
  useEffect(() => {
    if (failed) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    shouldAskPush().then((ask) => {
      if (!ask) return;
      timer = setTimeout(() => {
        markPushAsked();
        setNotifyOpen(true);
      }, 1200);
    });
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [failed]);

  // 쌓인 설문 화면을 모두 닫고 탭으로
  const goTab = (tab: "/surveys" | "/home") => {
    router.dismissAll();
    router.navigate(tab);
  };

  // 다음 설문 하기: 추천 1번 설문 상세로 (없으면 설문 탭)
  const goNext = () => {
    if (next.length === 0) {
      goTab("/surveys");
      return;
    }
    router.replace({ pathname: "/survey/[id]", params: { id: String(next[0].id) } });
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "응답 완료", headerBackVisible: false, gestureEnabled: false }} />

      {failed ? (
        // 확인 문항을 틀렸거나 너무 빨리 응답한 경우: 포인트 없음, 다시 응답 가능 (2026-10-30·31 결정)
        <View style={styles.failBody}>
          <View style={[styles.circle, styles.circleFail]}>
            <Image source={QUESTION} style={styles.character} contentFit="contain" accessible={false} />
          </View>
          <Text style={styles.title}>포인트가 지급되지 않았어요</Text>
          <Text style={styles.message}>
            {reason === "too_fast"
              ? "문항을 읽기 어려울 만큼 너무 빨리 응답했어요.\n천천히 읽고 답해 주세요."
              : "성실한 응답 확인 문항의 답이 달랐어요."}
          </Text>
          <Text style={styles.message}>다시 응답하면 포인트를 받을 수 있어요.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
          {/* 캐릭터: 연파랑 동그라미가 톡 커지고, 캐릭터가 한 번 콩 뛴다 */}
          <View style={styles.hero}>
            <Animated.View entering={ZoomIn.duration(450)} style={styles.circle} />
            <Hop>
              <Image source={CHEER} style={styles.character} contentFit="contain" accessibilityLabel="옛썰 캐릭터" />
            </Hop>
          </View>
          <Animated.View entering={ZoomIn.delay(350).duration(400)} style={styles.rewardPill}>
            <Text style={styles.rewardText}>+{formatPoints(earned)} 적립!</Text>
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(500).duration(450)} style={styles.center}>
            <Text style={styles.title}>응답해 주셔서 고마워요</Text>
            <Text style={styles.message}>당신의 한 번의 답변이 큰 변화를 만들 수 있어요.</Text>
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(650).duration(450)} style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>내 포인트</Text>
            <CountUp to={balance} from={balance === null ? null : Math.max(balance - earned, 0)} />
          </Animated.View>

          {/* 보상 연락처: 카드 → 바텀시트에서 번호 남기기 → "남겼어요" 카드 */}
          {rewardNote && (
            <Animated.View entering={FadeInUp.delay(800).duration(450)} style={styles.stretch}>
              {contactLeft ? (
                <Pressable onPress={() => setSheetOpen(true)} style={styles.contactDone}>
                  <View style={styles.contactDoneIcon}>
                    <AppIcon name={uiIcons.check} size={22} color={colors.onAccent} />
                  </View>
                  <View style={styles.cardMain}>
                    <Text style={styles.cardTitle}>보상 연락처를 남겼어요</Text>
                    <Text style={styles.cardSub}>바꾸려면 눌러서 다시 남기면 돼요</Text>
                  </View>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => setSheetOpen(true)}
                  style={({ pressed }) => [styles.contactCard, pressed && styles.pressed]}
                >
                  <View style={styles.contactIcon}>
                    <AppIcon name={uiIcons.gift} size={22} color={colors.pastelPeachText} />
                  </View>
                  <View style={styles.cardMain}>
                    <Text style={styles.cardTitle}>
                      보상 받기 <Text style={styles.optional}>(선택)</Text>
                    </Text>
                    <Text style={styles.cardSubStrong} numberOfLines={2}>
                      {rewardNote}
                    </Text>
                  </View>
                  <AppIcon name={uiIcons.chevron} size={18} color={colors.pastelPeachText} />
                </Pressable>
              )}
            </Animated.View>
          )}

          {/* 다른 학생들은 어떻게 답했을까? (결과 공개 설문만) */}
          {(visibility === "public" || visibility === "campus") && (
            <Animated.View entering={FadeInUp.delay(900).duration(450)} style={[styles.stretch, styles.infoCard]}>
              <View style={styles.infoIcon}>
                <AppIcon name={uiIcons.chart} size={22} color={colors.primary} />
              </View>
              <View style={styles.cardMain}>
                <Text style={styles.infoTitle}>다른 학생들은 어떻게 답했을까?</Text>
                <Text style={styles.cardSub}>{RESULT_NOTE[visibility]}</Text>
              </View>
            </Animated.View>
          )}

          {/* 이어서 하기 좋은 설문 */}
          {next.length > 0 && (
            <Animated.View entering={FadeInUp.delay(1000).duration(450)} style={[styles.stretch, styles.nextSection]}>
              <Text style={styles.nextTitle}>이어서 하기 좋은 설문</Text>
              <View style={styles.nextList}>
                {next.map((s) => (
                  <SurveyRowCard key={s.id} survey={s} />
                ))}
              </View>
            </Animated.View>
          )}
        </ScrollView>
      )}

      <BottomBar>
        {failed ? (
          <>
            <Button title="다른 설문" variant="outline" onPress={() => goTab("/surveys")} style={styles.side} />
            <Button
              title="다시 응답하기"
              onPress={() => router.replace({ pathname: "/survey/respond", params: { id } })}
              style={styles.main}
            />
          </>
        ) : (
          <>
            <Button title="홈으로" variant="outline" onPress={() => goTab("/home")} style={styles.side} />
            <Button title={next.length > 0 ? "다음 설문 하기" : "다른 설문 보기"} onPress={goNext} style={styles.main} />
          </>
        )}
      </BottomBar>

      {notifyOpen && !sheetOpen && <NotifySheet onClose={() => setNotifyOpen(false)} />}

      {sheetOpen && rewardNote && (
        <ContactSheet
          surveyId={surveyId}
          note={rewardNote}
          onClose={() => setSheetOpen(false)}
          onSaved={() => {
            setContactLeft(true);
            setSheetOpen(false);
          }}
        />
      )}
    </View>
  );
}

// 내 포인트: 적립 전 → 적립 후로 숫자가 올라간다 (0.7초 뒤 시작, 약 0.6초). 동작 줄이기면 바로 최종값
function CountUp({ from, to }: { from: number | null; to: number | null }) {
  const reduce = useReducedMotion();
  // 몇 칸째까지 올라갔는지 (0 = 적립 전 숫자, STEPS = 적립 후 숫자)
  const [step, setStep] = useState(0);
  const animate = !reduce && from !== null && to !== null && from !== to;

  useEffect(() => {
    if (!animate) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      timer = setInterval(() => {
        setStep((s) => {
          if (s + 1 >= COUNT_STEPS && timer) clearInterval(timer);
          return Math.min(s + 1, COUNT_STEPS);
        });
      }, 50);
    }, 700);
    return () => {
      clearTimeout(start);
      if (timer) clearInterval(timer);
    };
  }, [animate]);

  if (to === null || from === null) return <Text style={styles.balanceValue}>…</Text>;
  const shown = animate ? Math.round(from + ((to - from) * step) / COUNT_STEPS) : to;
  return <Text style={styles.balanceValue}>{formatPoints(shown)}</Text>;
}

// 보상 연락처 바텀시트 (공용 BottomSheet, 안에 번호 입력칸이 있어 키보드 따라 올라감)
function ContactSheet({
  surveyId,
  note,
  onClose,
  onSaved,
}: {
  surveyId: number;
  note: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <BottomSheet onClose={onClose} closeLabel="다음에 할게요" keyboard>
      <Text style={styles.sheetTitle}>보상 받을 연락처</Text>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>
        <RewardContactForm surveyId={surveyId} note={note} onSaved={onSaved} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  body: {
    alignItems: "center",
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  failBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  center: {
    alignItems: "center",
  },
  stretch: {
    alignSelf: "stretch",
  },
  hero: {
    width: 168,
    height: 150,
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
  circleFail: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceMuted,
  },
  character: {
    width: 150,
    height: 112,
  },
  rewardPill: {
    marginTop: 18,
    paddingVertical: spacing.sm,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  rewardText: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.onAccent,
  },
  title: {
    marginTop: spacing.md,
    fontSize: fontSize.title,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  message: {
    marginTop: 6,
    fontSize: 15,
    color: colors.iconStrong,
    textAlign: "center",
    lineHeight: 22,
  },
  balanceBox: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  balanceLabel: {
    fontSize: fontSize.label,
    color: colors.iconStrong,
  },
  balanceValue: {
    minWidth: 64,
    textAlign: "right",
    fontSize: 20,
    fontWeight: "800",
    color: colors.primary,
  },
  contactCard: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: spacing.md,
    borderRadius: radius.xl,
    // 목록 카드 "보상" 알약과 같은 살구색 (2026-11-13). 남긴 뒤 카드는 완료 색(연두)
    backgroundColor: colors.pastelPeach,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  contactDone: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  contactDoneIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  cardMain: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  optional: {
    fontSize: fontSize.caption,
    fontWeight: "500",
    color: colors.pastelPeachText,
  },
  cardSub: {
    fontSize: fontSize.small,
    color: colors.iconStrong,
  },
  cardSubStrong: {
    fontSize: fontSize.small,
    color: colors.textStrong,
  },
  infoCard: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  infoIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  nextSection: {
    marginTop: spacing.xl,
    gap: 12,
  },
  nextTitle: {
    paddingHorizontal: spacing.xs,
    fontSize: fontSize.subtitle,
    fontWeight: "800",
    color: colors.text,
  },
  nextList: {
    gap: 10,
  },
  side: {
    width: 104,
  },
  main: {
    flex: 1,
  },
  sheetTitle: {
    marginTop: 22,
    marginBottom: spacing.md,
    fontSize: fontSize.title,
    fontWeight: "800",
    color: colors.text,
  },
  sheetBody: {
    paddingBottom: spacing.sm,
  },
});
