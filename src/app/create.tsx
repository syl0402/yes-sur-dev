// ys-120 설문 작성 · F-401~405
import { Stack, router, useLocalSearchParams, usePreventRemove } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import BasicsStep from "@/components/create/BasicsStep";
import ConfirmStep from "@/components/create/ConfirmStep";
import QuestionsStep from "@/components/create/QuestionsStep";
import SettingsStep from "@/components/create/SettingsStep";
import PrimaryButton from "@/components/PrimaryButton";
import StepIndicator from "@/components/StepIndicator";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import { showChoice, showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { formatPoints } from "@/lib/format";
import { showNotice } from "@/lib/notice";
import { fetchRules } from "@/lib/rules";
import { supabase } from "@/lib/supabase";
import {
  CREATE_RULE_KEYS,
  type SurveyDraft,
  basicsValid,
  deleteDraft,
  emptyDraft,
  getDraft,
  isBlankDraft,
  makeRequestId,
  questionsValid,
  registrationCost,
  saveDraft,
  settingsValid,
  toRpcQuestions,
} from "@/lib/surveyDraft";

const STEP_COUNT = 4;

type Setup = {
  // 임시저장을 계정마다 따로 두기 위한 내 계정 id
  userId: string;
  rules: Record<string, number>;
  categories: { id: number; name: string }[];
  isOrg: boolean;
  // 작성자로 표시될 단체 이름 (학생은 null)
  orgName: string | null;
  hasSchool: boolean;
  balance: number;
  // 가장 작은 설문(1문항·최소 인원)의 등록비. 이것도 못 내면 작성 전에 안내한다
  minCost: number;
};

// 작성에 필요한 것: 설정값·카테고리·내 계정 종류·학교·잔액 (모두 본인 것만 읽힌다)
async function fetchSetup(): Promise<Setup> {
  const [{ data: auth }, rules, { data: categories }, { data: profile }, { data: balance }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    fetchRules(CREATE_RULE_KEYS),
    supabase.from("survey_categories").select("id, name").order("sort_order"),
    supabase.from("profiles").select("account_type, university_id").maybeSingle(),
    supabase.rpc("get_my_balance"),
    supabase.from("organizations").select("name, kind, universities(name)").maybeSingle(),
  ]);
  const isOrg = profile?.account_type === "org";

  // 설문에 보일 작성자 이름 (서버 survey_host_name()과 같은 규칙: 교내 단체는 학교 이름을 앞에)
  const rawSchool = org?.universities as unknown;
  const school = ((Array.isArray(rawSchool) ? rawSchool[0] : rawSchool) as { name: string } | null)?.name;
  const orgName =
    org && org.kind === "campus" && school && !org.name.includes(school) ? `${school} ${org.name}` : (org?.name ?? null);
  return {
    userId: auth.user?.id ?? "",
    rules,
    categories: categories ?? [],
    isOrg,
    orgName: isOrg ? orgName : null,
    hasSchool: profile?.university_id != null,
    balance: typeof balance === "number" ? balance : 0,
    minCost: isOrg ? rules.cost_survey_create_org : rules.price_1q * rules.survey_min_target,
  };
}

export default function CreateSurvey() {
  // ?draft=번호 로 들어오면 임시저장함의 그 설문을 이어 쓴다 (마이 탭 "임시저장한 설문")
  const { draft: draftParam } = useLocalSearchParams<{ draft?: string }>();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [draft, setDraft] = useState<SurveyDraft>(emptyDraft);
  const [step, setStep] = useState(1);
  const [sending, setSending] = useState(false);
  // 임시저장 번호 = 등록 요청 번호: [등록]을 연타·재시도하거나 임시저장에서 다시 등록해도 설문 1개, 비용 1번
  const [draftId] = useState(() => draftParam ?? makeRequestId());
  // 마지막으로 불러오거나 임시저장한 내용. 지금 내용과 다르면 "바뀐 게 있음"
  const [savedJson, setSavedJson] = useState<string | null>(null);

  useEffect(() => {
    fetchSetup().then((s) => {
      setSetup(s);
      const saved = getDraft(s.userId, draftId);
      if (saved) {
        // 공개 범위가 생기기 전에 임시저장한 설문은 기본값(전체 공개)으로
        const loaded = { ...saved.draft, resultVisibility: saved.draft.resultVisibility ?? "public" };
        setDraft(loaded);
        setSavedJson(JSON.stringify(loaded));
        setStep(saved.step);
        return;
      }
      const fresh = {
        ...emptyDraft(),
        target: String(s.rules.survey_default_target),
        days: String(s.rules.survey_default_days),
      };
      setDraft(fresh);
      setSavedJson(JSON.stringify(fresh));
    });
  }, [draftId]);

  // 임시저장은 직접 고를 때만 (오른쪽 위 [임시저장], 또는 나갈 때 창에서). 자동 저장은 하지 않는다
  const changed = savedJson !== null && !isBlankDraft(draft) && JSON.stringify(draft) !== savedJson;
  const notEnough = setup !== null && setup.balance < setup.minCost;

  // 뒤로 가기: 2단계 이상이면 이전 단계로. 1단계에서 바뀐 게 있으면 임시저장할지 고르기
  const allowLeave = usePreventRemove(setup !== null && !notEnough, ({ repeat }) => {
    if (step > 1) {
      setStep(step - 1);
      return;
    }
    if (!changed || setup === null) {
      repeat();
      return;
    }
    showChoice({
      title: "작성 중인 설문이 있어요",
      message: "임시저장하면 마이 탭 '임시저장한 설문'에서 이어 쓸 수 있어요.",
      primary: {
        label: "임시저장하고 나가기",
        onPress: () => {
          saveDraft(setup.userId, draftId, draft, step);
          repeat();
        },
      },
      destructive: { label: "저장하지 않고 나가기", onPress: repeat },
      cancelLabel: "계속 작성",
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
        <Text style={styles.gateTitle}>등록에 최소 {formatPoints(setup.minCost)}가 필요해요</Text>
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

  // 등록비 = 응답 1명 받는 값 × 목표 인원 (화면 표시용. 실제 차감은 서버)
  const cost = registrationCost(draft, rules, setup.isOrg);
  const affordable = cost <= setup.balance;

  const stepOk =
    step === 1
      ? basicsValid(draft)
      : step === 2
        ? questionsValid(draft, rules)
        : step === 3
          ? settingsValid(draft, rules, setup.hasSchool) && affordable
          : affordable;

  const submit = async () => {
    setSending(true);
    // 금액은 보내지 않는다. 소요시간·보상·비용은 서버가 정한다
    const { data: surveyId, error } = await supabase.rpc("create_survey", {
      p_request_id: draftId,
      p_category_id: draft.categoryId,
      p_title: draft.title.trim(),
      p_description: draft.description.trim(),
      p_audience: draft.audience,
      p_target: Number(draft.target),
      p_days: Number(draft.days),
      p_questions: toRpcQuestions(draft),
      p_result_visibility: draft.resultVisibility,
    });
    setSending(false);

    if (error) {
      showNotice("등록하지 못했어요", errorMessage(error));
      return;
    }

    // 등록됐으니 임시저장은 지운다. 작성 화면을 내 설문 상세로 교체 (뒤로 가기로 돌아오지 않게)
    deleteDraft(setup.userId, draftId);
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
      message: cost > 0 ? `${formatPoints(cost)}가 차감돼요.` : "등록한 뒤에는 고칠 수 없어요.",
      okLabel: "등록",
      cancelLabel: "다시 보기",
      onOk: submit,
    });
  };

  const categoryName = setup.categories.find((c) => c.id === draft.categoryId)?.name ?? "";

  // 오른쪽 위 [임시저장]: 지금 내용을 이 폰 임시저장함에 저장
  const canSave = !isBlankDraft(draft) && !sending;
  const saveNow = () => {
    saveDraft(setup.userId, draftId, draft, step);
    setSavedJson(JSON.stringify(draft));
    showNotice("임시저장했어요", "마이 탭 '임시저장한 설문'에서 이어 쓸 수 있어요.");
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: "설문 등록",
          headerRight: () => (
            <Pressable onPress={saveNow} disabled={!canSave} hitSlop={8}>
              <Text style={[styles.headerButton, !canSave && styles.headerButtonDisabled]}>임시저장</Text>
            </Pressable>
          ),
        }}
      />

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
        {step === 3 && (
          <SettingsStep
            draft={draft}
            rules={rules}
            hasSchool={setup.hasSchool}
            isOrg={setup.isOrg}
            cost={cost}
            balance={setup.balance}
            onChange={update}
          />
        )}
        {step === 4 && (
          <ConfirmStep
            draft={draft}
            rules={rules}
            categoryName={categoryName}
            cost={cost}
            balance={setup.balance}
            isOrg={setup.isOrg}
            orgName={setup.orgName}
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
  headerButton: {
    fontSize: fontSize.body,
    color: colors.primary,
  },
  headerButtonDisabled: {
    color: colors.disabled,
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
