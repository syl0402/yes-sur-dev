// 설문 작성 화면(ys-120)에서 쓰는 작성 중인 설문의 모양과 검사·계산.
// 글자 수 한도는 서버 create_survey와 같게 맞춘다 (docs/DB.md "create_survey 입력 규칙")

export type QuestionType = "single" | "multi" | "scale" | "text";

export type DraftQuestion = {
  // 화면 목록용 임시 번호 (DB 번호 아님)
  key: string;
  type: QuestionType;
  text: string;
  // 단일·복수 선택에서만 쓴다
  options: string[];
};

export type SurveyDraft = {
  title: string;
  description: string;
  categoryId: number | null;
  questions: DraftQuestion[];
  audience: "all" | "campus";
  // 입력칸 글자 그대로 (숫자 검사는 settingsValid에서)
  target: string;
  days: string;
};

export const TITLE_MIN = 2;
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 500;
export const QUESTION_TEXT_MAX = 200;
export const OPTION_TEXT_MAX = 100;

// 작성 화면에서 읽는 point_rules 설정값
export const CREATE_RULE_KEYS = [
  "survey_max_questions",
  "survey_max_options",
  "survey_min_target",
  "survey_max_target",
  "survey_default_target",
  "survey_max_days",
  "survey_default_days",
  "attention_min_questions",
  "answer_text_max",
  "sec_per_choice",
  "sec_per_text",
  "reward_1q",
  "reward_lt5",
  "reward_5to15",
  "reward_gte15",
  "cost_survey_create",
  "cost_survey_create_org",
];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: "하나 고르기",
  multi: "여러 개 고르기",
  scale: "5점 척도",
  text: "주관식",
};

// 5점 척도 보기 (서버 주의 문항과 같은 표현)
export const SCALE_LABELS = ["전혀 아니에요", "아니에요", "보통이에요", "그래요", "매우 그래요"];

export function isChoice(type: QuestionType): boolean {
  return type === "single" || type === "multi";
}

// 같은 요청이 두 번 와도 설문이 하나만 만들어지게 하는 요청 번호 (무작위 uuid 형식)
export function makeRequestId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r % 4) + 8).toString(16);
  });
}

export function newQuestion(): DraftQuestion {
  return { key: makeRequestId(), type: "single", text: "", options: ["", ""] };
}

export function emptyDraft(): SurveyDraft {
  return {
    title: "",
    description: "",
    categoryId: null,
    questions: [newQuestion()],
    audience: "all",
    target: "",
    days: "",
  };
}

// ① 기본 정보
export function basicsValid(d: SurveyDraft): boolean {
  const title = d.title.trim().length;
  return title >= TITLE_MIN && title <= TITLE_MAX && d.description.trim().length <= DESCRIPTION_MAX && d.categoryId !== null;
}

// ② 문항
export function questionValid(q: DraftQuestion, rules: Record<string, number>): boolean {
  const text = q.text.trim().length;
  if (text < 1 || text > QUESTION_TEXT_MAX) return false;
  if (!isChoice(q.type)) return true;
  return (
    q.options.length >= 2 &&
    q.options.length <= rules.survey_max_options &&
    q.options.every((o) => o.trim().length >= 1 && o.trim().length <= OPTION_TEXT_MAX)
  );
}

export function questionsValid(d: SurveyDraft, rules: Record<string, number>): boolean {
  return (
    d.questions.length >= 1 &&
    d.questions.length <= rules.survey_max_questions &&
    d.questions.every((q) => questionValid(q, rules))
  );
}

// ③ 대상·마감
export function settingsValid(d: SurveyDraft, rules: Record<string, number>, hasSchool: boolean): boolean {
  const target = Number(d.target);
  const days = Number(d.days);
  return (
    (d.audience === "all" || hasSchool) &&
    Number.isInteger(target) &&
    target >= rules.survey_min_target &&
    target <= rules.survey_max_target &&
    Number.isInteger(days) &&
    days >= 1 &&
    days <= rules.survey_max_days
  );
}

// 예상 소요시간·응답자 보상 (화면 표시용. 서버 create_survey·calc_survey_reward와 같은 계산)
export function estimate(d: SurveyDraft, rules: Record<string, number>): { minutes: number; reward: number } {
  const seconds = d.questions.reduce(
    (sum, q) => sum + (q.type === "text" ? rules.sec_per_text : rules.sec_per_choice),
    0,
  );
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  const count = d.questions.length;
  const reward =
    count === 1
      ? rules.reward_1q
      : minutes < 5
        ? rules.reward_lt5
        : minutes < 15
          ? rules.reward_5to15
          : rules.reward_gte15;
  return { minutes, reward };
}

// create_survey에 보낼 문항 형식
export function toRpcQuestions(d: SurveyDraft) {
  return d.questions.map((q) =>
    isChoice(q.type)
      ? { type: q.type, text: q.text.trim(), options: q.options.map((o) => o.trim()) }
      : { type: q.type, text: q.text.trim() },
  );
}
