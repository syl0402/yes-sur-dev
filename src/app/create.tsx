// ys-120 설문 작성 · F-401~405
import { Stack, router, usePreventRemove } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import BasicsStep from "@/components/create/BasicsStep";
import ConfirmStep from "@/components/create/ConfirmStep";
import QuestionsStep from "@/components/create/QuestionsStep";
import SettingsStep from "@/components/create/SettingsStep";
import PrimaryButton from "@/components/PrimaryButton";
import StepIndicator from "@/components/StepIndicator";
import { colors, fontSize, spacing } from "@/constants/theme";
import { showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { formatPoints } from "@/lib/format";
import { showNotice } from "@/lib/notice";
import { fetchRules } from "@/lib/rules";
import { supabase } from "@/lib/supabase";
import {
  CREATE_RULE_KEYS,
  type SurveyDraft,
  basicsValid,
  emptyDraft,
  makeRequestId,
  questionsValid,
  settingsValid,
  toRpcQuestions,
} from "@/lib/surveyDraft";

const STEP_COUNT = 4;

type Setup = {
  rules: Record<string, number>;
  categories: { id: number; name: string }[];
  isOrg: boolean;
  hasSchool: boolean;
  balance: number;
  cost: number;
};

// 작성에 필요한 것: 설정값·카테고리·내 계정 종류·학교·잔액 (모두 본인 것만 읽힌다)
async function fetchSetup(): Promise<Setup> {
  const [rules, { data: categories }, { data: profile }, { data: balance }] = await Promise.all([
    fetchRules(CREATE_RULE_KEYS),
    supabase.from("survey_categories").select("id, name").order("sort_order"),
    supabase.from("profiles").select("account_type, university_id").maybeSingle(),
    supabase.rpc("get_my_balance"),
  ]);
  const isOrg = profile?.account_type === "org";
  return {
    rules,
    categories: categories ?? [],
    isOrg,
    hasSchool: profile?.university_id != null,
    balance: typeof balance === "number" ? balance : 0,
    cost: isOrg ? rules.cost_survey_create_org : rules.cost_survey_create,
  };
}

export default function CreateSurvey() {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [draft, setDraft] = useState<SurveyDraft>(emptyDraft);
  const [step, setStep] = useState(1);
  const [sending, setSending] = useState(false);
  // 이 작성 화면의 요청 번호: [등록]을 연타·재시도해도 설문 1개, 비용 1번
  const [requestId] = useState(makeRequestId);

  useEffect(() => {
    fetchSetup().then((s) => {
      setSetup(s);
      setDraft((d) => ({
        ...d,
        target: String(s.rules.survey_default_target),
        days: String(s.rules.survey_default_days),
      }));
    });
  }, []);

  const notEnough = setup !== null && setup.balance < setup.cost;

  // 뒤로 가기: 2단계 이상이면 이전 단계로, 1단계면 그만둘지 확인 (작성 내용은 저장되지 않는다)
  const allowLeave = usePreventRemove(setup !== null && !notEnough, ({ repeat }) => {
    if (step > 1) {
      setStep(step - 1);
      return;
    }
    showConfirm({
      title: "작성을 그만둘까요?",
      message: "입력한 내용은 저장되지 않아요.",
      okLabel: "나가기",
      cancelLabel: "계속 작성",
      destructive: true,
      onOk: repeat,
    });
  });

  if (setup === null) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "설문 등록" }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // 잔액 부족: 작성 전에 안내 (다 쓰고 막히지 않게)
  if (notEnough) {
    const goSurveys = () => {
      router.dismissAll();
      router.navigate("/surveys");
    };
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "설문 등록" }} />
        <Text style={styles.gateTitle}>등록에 {formatPoints(setup.cost)}가 필요해요</Text>
        <Text style={styles.gateText}>지금 내 포인트는 {formatPoints(setup.balance)}예요.</Text>
        <Text style={styles.gateText}>다른 설문에 참여해서 포인트를 모아 보세요.</Text>
        <View style={styles.gateButton}>
          <PrimaryButton title="설문 참여하기" onPress={goSurveys} />
        </View>
      </View>
    );
  }

  const { rules } = setup;
  const update = (patch: Partial<SurveyDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const stepOk =
    step === 1
      ? basicsValid(draft)
      : step === 2
        ? questionsValid(draft, rules)
        : step === 3
          ? settingsValid(draft, rules, setup.hasSchool)
          : true;

  const submit = async () => {
    setSending(true);
    // 금액은 보내지 않는다. 소요시간·보상·비용은 서버가 정한다
    const { data: surveyId, error } = await supabase.rpc("create_survey", {
      p_request_id: requestId,
      p_category_id: draft.categoryId,
      p_title: draft.title.trim(),
      p_description: draft.description.trim(),
      p_audience: draft.audience,
      p_target: Number(draft.target),
      p_days: Number(draft.days),
      p_questions: toRpcQuestions(draft),
    });
    setSending(false);

    if (error) {
      showNotice("등록하지 못했어요", errorMessage(error));
      return;
    }

    // 작성 화면을 내 설문 상세로 교체 (뒤로 가기로 작성 화면에 돌아오지 않게)
    allowLeave();
    router.replace({ pathname: "/survey/[id]", params: { id: String(surveyId) } });
    showNotice("등록했어요", "응답이 모이면 마이 탭 '내가 올린 설문'에서 볼 수 있어요.");
  };

  const goNext = () => {
    if (step < STEP_COUNT) {
      setStep(step + 1);
      return;
    }
    showConfirm({
      title: "등록할까요?",
      message: setup.cost > 0 ? `${formatPoints(setup.cost)}가 차감돼요.` : "등록한 뒤에는 고칠 수 없어요.",
      okLabel: "등록",
      cancelLabel: "다시 보기",
      onOk: submit,
    });
  };

  const categoryName = setup.categories.find((c) => c.id === draft.categoryId)?.name ?? "";

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "설문 등록" }} />

      {/* 아이폰 반투명 헤더·키보드에 입력칸이 가리지 않게. 단계가 바뀌면 맨 위부터 보이게(key) */}
      <ScrollView
        key={step}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.container}
      >
        <StepIndicator current={step} total={STEP_COUNT} />
        <Text style={styles.stepTitle}>
          {["기본 정보", "문항 만들기", "대상 · 인원 · 마감", "확인하고 등록"][step - 1]}
        </Text>

        {step === 1 && <BasicsStep draft={draft} categories={setup.categories} onChange={update} />}
        {step === 2 && <QuestionsStep draft={draft} rules={rules} onChange={update} />}
        {step === 3 && <SettingsStep draft={draft} rules={rules} hasSchool={setup.hasSchool} onChange={update} />}
        {step === 4 && (
          <ConfirmStep
            draft={draft}
            rules={rules}
            categoryName={categoryName}
            cost={setup.cost}
            balance={setup.balance}
            isOrg={setup.isOrg}
          />
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 1 && (
          <Pressable style={styles.prevButton} onPress={() => setStep(step - 1)} disabled={sending}>
            <Text style={styles.prevText}>이전</Text>
          </Pressable>
        )}
        <View style={styles.nextButton}>
          <PrimaryButton
            title={step === STEP_COUNT ? "등록" : "다음"}
            onPress={goNext}
            disabled={!stepOk}
            loading={sending}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  gateTitle: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  gateText: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: "center",
  },
  gateButton: {
    alignSelf: "stretch",
    marginTop: spacing.lg,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  stepTitle: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
  },
  footer: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  prevButton: {
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  prevText: {
    fontSize: fontSize.body,
    color: colors.text,
    fontWeight: "600",
  },
  nextButton: {
    flex: 1,
  },
});
