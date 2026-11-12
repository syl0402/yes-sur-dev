// ys-120 설문 작성 · F-401~405
import { Stack, router, useLocalSearchParams, usePreventRemove } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, View } from "react-native";

import BasicsStep from "@/components/create/BasicsStep";
import ConfirmStep from "@/components/create/ConfirmStep";
import LengthSummary from "@/components/create/LengthSummary";
import QuestionsStep from "@/components/create/QuestionsStep";
import SettingsStep from "@/components/create/SettingsStep";
import PrimaryButton from "@/components/PrimaryButton";
import StepIndicator from "@/components/StepIndicator";
import BottomBar from "@/components/ui/BottomBar";
import Button from "@/components/ui/Button";
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
  hasReward,
  isBlankDraft,
  makeRequestId,
  REWARD_NOTE_MIN,
  questionValid,
  questionsValid,
  registrationCost,
  saveDraft,
  settingsValid,
  TITLE_MIN,
  toRpcQuestions,
} from "@/lib/surveyDraft";
import { fetchTagSuggestions, fetchTags, type Tag } from "@/lib/tags";

const STEP_COUNT = 4;

// 단계별 큰 제목 (2026-11-12 설문 흐름 시안)
const STEP_TITLES = ["어떤 설문인가요?", "문항 만들기", "대상 · 공개 · 보상", "확인하고 등록"];

// [다음]을 누를 수 없을 때 버튼 안에 보여 줄 이유 (2026-11-12 시안). 없으면 "다음" 그대로
// ②③④ 이유 문구는 각 단계 시안을 반영할 때 더한다
function blockedReason(
  step: number,
  draft: SurveyDraft,
  rules: Record<string, number>,
  affordable: boolean,
): string | null {
  if (step === 1) {
    const title = draft.title.trim().length;
    if (title === 0) return "제목을 써 주세요";
    if (title < TITLE_MIN) return `제목을 ${TITLE_MIN}자 이상 써 주세요`;
    if (draft.categoryId === null) return "카테고리를 골라 주세요";
  }
  if (step === 2) {
    // 처음으로 덜 채운 문항을 알려 준다
    const i = draft.questions.findIndex((q) => !questionValid(q, rules));
    if (i >= 0) {
      const q = draft.questions[i];
      return q.text.trim() === "" ? `Q${i + 1} 질문을 써 주세요` : `Q${i + 1} 보기를 채워 주세요`;
    }
  }
  if (step === 3) {
    const target = Number(draft.target);
    if (!Number.isInteger(target) || target < rules.survey_min_target || target > rules.survey_max_target) {
      return `인원을 ${rules.survey_min_target}~${rules.survey_max_target}명으로 맞춰 주세요`;
    }
    const days = Number(draft.days);
    if (!Number.isInteger(days) || days < 1 || days > rules.survey_max_days) return "마감일을 골라 주세요";
    if (hasReward(draft) && (draft.rewardNote ?? "").trim().length < REWARD_NOTE_MIN) return "보상 안내를 더 써 주세요";
    if (hasReward(draft) && draft.rewardAgreed !== true) return "보상 연락처 약속에 체크해 주세요";
  }
  if ((step === 3 || step === 4) && !affordable) return "인원을 줄여 주세요";
  return null;
}

type Setup = {
  // 임시저장을 계정마다 따로 두기 위한 내 계정 id
  userId: string;
  rules: Record<string, number>;
  categories: { id: number; name: string }[];
  tags: Tag[];
  // 카테고리 번호 → 추천 태그 번호 (2026-11-12)
  tagSuggestions: Record<number, number[]>;
  isOrg: boolean;
  // 작성자로 표시될 단체 이름 (학생은 null)
  orgName: string | null;
  // 학생 닉네임 (작성자 표시 고르기)
  nickname: string | null;
  hasSchool: boolean;
  // 내 학교 이름 (확인 단계 미리보기 카드 "중앙대생만" 알약, 2026-11-13)
  schoolName: string;
  balance: number;
  // 가장 작은 설문(1문항·최소 인원)의 등록비. 이것도 못 내면 작성 전에 안내한다
  minCost: number;
};

// 작성에 필요한 것: 설정값·카테고리·내 계정 종류·학교·잔액 (모두 본인 것만 읽힌다)
async function fetchSetup(): Promise<Setup> {
  const [{ data: auth }, rules, { data: categories }, tags, { data: profile }, { data: balance }, { data: org }, tagSuggestions] = await Promise.all([
    supabase.auth.getUser(),
    fetchRules(CREATE_RULE_KEYS),
    supabase.from("survey_categories").select("id, name").order("sort_order"),
    fetchTags(),
    supabase.from("profiles").select("account_type, university_id, nickname, universities(name)").maybeSingle(),
    supabase.rpc("get_my_balance"),
    supabase.from("organizations").select("name, kind, universities(name)").maybeSingle(),
    fetchTagSuggestions(),
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
    tags,
    tagSuggestions,
    isOrg,
    orgName: isOrg ? orgName : null,
    nickname: isOrg ? null : (profile?.nickname ?? null),
    hasSchool: profile?.university_id != null,
    schoolName:
      ((Array.isArray(profile?.universities) ? profile?.universities[0] : profile?.universities) as { name: string } | null)
        ?.name ?? "",
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
  // 카테고리를 고르면 아래에 열린 태그 칸으로 부드럽게 내려간다 (태그 칸이 ① 단계 맨 아래, 2026-11-12)
  const scrollRef = useRef<ScrollViewInstance>(null);
  const showTags = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);

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

    // 태그 붙이기 (실패해도 설문은 등록됨 → 안내 문구에 덧붙임)
    const tagIds = draft.tagIds ?? [];
    let tagFailed = false;
    if (tagIds.length > 0) {
      const { error: tagError } = await supabase.rpc("set_survey_tags", { p_survey_id: surveyId, p_tag_ids: tagIds });
      tagFailed = tagError !== null;
    }

    // 보상 연락처 받기 (실패해도 설문은 등록됨 → 안내 문구에 덧붙임)
    let rewardFailed = false;
    if (hasReward(draft)) {
      const { error: rewardError } = await supabase.rpc("set_survey_reward", {
        p_survey_id: surveyId,
        p_note: (draft.rewardNote ?? "").trim(),
      });
      rewardFailed = rewardError !== null;
    }

    // 닉네임 공개를 골랐으면 작성자 이름을 닉네임으로 (실패해도 설문은 등록됨 → "옛썰러"로 보임)
    if (!setup.isOrg && draft.showNickname) {
      await supabase.rpc("set_survey_show_nickname", { p_survey_id: surveyId, p_show: true });
    }

    // 등록됐으니 임시저장은 지운다. 작성 화면을 내 설문 상세로 교체 (뒤로 가기로 돌아오지 않게)
    deleteDraft(setup.userId, draftId);
    allowLeave();
    router.replace({ pathname: "/survey/[id]", params: { id: String(surveyId) } });
    showNotice(
      "등록했어요",
      "응답이 모이면 마이 탭 '내가 올린 설문'에서 볼 수 있어요." + (tagFailed ? "\n태그는 붙이지 못했어요." : "") +
        (rewardFailed ? "\n보상 안내는 저장하지 못했어요." : ""),
    );
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
            // 웹은 제목줄 오른쪽 여백이 없어 버튼이 끝에 붙는다 (2026-11-09 피드백)
            <Pressable onPress={saveNow} disabled={!canSave} hitSlop={8} style={styles.headerAction}>
              <Text style={[styles.headerButton, !canSave && styles.headerButtonDisabled]}>임시저장</Text>
            </Pressable>
          ),
        }}
      />

      {/* 아이폰 반투명 헤더·키보드에 입력칸이 가리지 않게. 단계가 바뀌면 맨 위부터 보이게(key) */}
      <ScrollView
        ref={scrollRef}
        key={step}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.container}
      >
        <StepIndicator current={step} total={STEP_COUNT} />
        <Text style={styles.stepTitle}>{STEP_TITLES[step - 1]}</Text>

        {step === 1 && (
          <BasicsStep
            draft={draft}
            categories={setup.categories}
            tags={setup.tags}
            suggestions={setup.tagSuggestions}
            onCategoryPicked={showTags}
            tagMax={rules.survey_tag_max ?? 0}
            onChange={update}
          />
        )}
        {step === 2 && <QuestionsStep draft={draft} rules={rules} onChange={update} />}
        {/* 문항을 넣고 빼면 바로 바뀌는 길이·구간·포인트 요약 (2026-11-09) */}
        {step === 2 && <LengthSummary draft={draft} rules={rules} isOrg={setup.isOrg} variant="questions" />}
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
            category={setup.categories.find((c) => c.id === draft.categoryId)?.name ?? ""}
            tags={setup.tags.filter((t) => (draft.tagIds ?? []).includes(t.id))}
            schoolName={setup.schoolName}
            cost={cost}
            balance={setup.balance}
            isOrg={setup.isOrg}
            orgName={setup.orgName}
            nickname={setup.nickname}
            onChange={update}
            onGoStep={setStep}
          />
        )}
      </ScrollView>

      <BottomBar>
        {/* 이전은 2단계부터 (2026-11-12 시안). 1단계는 다음 버튼이 넓게 */}
        {step > 1 && (
          <Button
            title="이전"
            variant="outline"
            onPress={() => setStep(step - 1)}
            disabled={sending}
            style={styles.prevButton}
          />
        )}
        <Button
          title={(!stepOk && blockedReason(step, draft, rules, affordable)) || (step === STEP_COUNT ? (cost > 0 ? `${formatPoints(cost)}로 등록하기` : "등록하기") : "다음")}
          onPress={goNext}
          disabled={!stepOk}
          loading={sending}
          style={styles.nextButton}
        />
      </BottomBar>
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
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  stepTitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },
  prevButton: {
    width: 104,
  },
  headerAction: {
    marginRight: Platform.OS === "web" ? spacing.md : 0,
  },
  headerButton: {
    fontSize: fontSize.body,
    color: colors.primary,
  },
  headerButtonDisabled: {
    color: colors.disabled,
  },
  nextButton: {
    flex: 1,
  },
});
