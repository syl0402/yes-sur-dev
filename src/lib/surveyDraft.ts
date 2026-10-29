// 설문 작성 화면(ys-120)에서 쓰는 작성 중인 설문의 모양과 검사·계산.
// 글자 수 한도는 서버 create_survey와 같게 맞춘다 (docs/DB.md "create_survey 입력 규칙")

export type QuestionType = "single" | "multi" | "scale" | "text";

export type ResultVisibility = "public" | "campus" | "private";

export const VISIBILITY_LABELS: Record<ResultVisibility, string> = {
  public: "전체 공개",
  campus: "우리 학교만",
  private: "비공개",
};

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
  // 결과 공개 범위: 전체 / 우리 학교만 / 비공개 (응답 대상과는 따로)
  resultVisibility: ResultVisibility;
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
  "price_1q",
  "price_lt5",
  "price_5to15",
  "price_gte15",
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

// ── 임시저장함 (2026-10-30): 이 폰 안에 계정마다 여러 개. 서버에는 저장하지 않는다 ──
// 폰은 expo-sqlite가 만든 localStorage(src/lib/storage.native.ts), 웹은 브라우저 localStorage
// 임시저장 번호(id)는 등록할 때 요청 번호로도 쓴다 → 같은 임시저장을 두 번 등록해도 설문은 1개

export type SavedDraft = {
  id: string;
  draft: SurveyDraft;
  step: number;
  // 마지막으로 저장한 시각 (ISO 문자열)
  savedAt: string;
};

function draftsKey(userId: string): string {
  return `survey_drafts:${userId}`;
}

function readAll(userId: string): SavedDraft[] {
  try {
    const raw = localStorage.getItem(draftsKey(userId));
    return raw ? (JSON.parse(raw) as SavedDraft[]) : [];
  } catch {
    return [];
  }
}

function writeAll(userId: string, list: SavedDraft[]) {
  try {
    localStorage.setItem(draftsKey(userId), JSON.stringify(list));
  } catch {
    // 저장이 안 돼도 작성은 계속할 수 있게 조용히 넘어간다
  }
}

// 임시저장 목록 (최근 저장 순)
export function listDrafts(userId: string): SavedDraft[] {
  return readAll(userId).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function getDraft(userId: string, id: string): SavedDraft | null {
  return readAll(userId).find((d) => d.id === id) ?? null;
}

export function saveDraft(userId: string, id: string, draft: SurveyDraft, step: number) {
  const others = readAll(userId).filter((d) => d.id !== id);
  writeAll(userId, [...others, { id, draft, step, savedAt: new Date().toISOString() }]);
}

export function deleteDraft(userId: string, id: string) {
  writeAll(
    userId,
    readAll(userId).filter((d) => d.id !== id),
  );
}

// 아직 아무것도 안 쓴 상태인지 (목표 인원·마감 기본값은 빼고 본다) → 이때는 저장하지 않는다
export function isBlankDraft(d: SurveyDraft): boolean {
  return (
    d.title.trim() === "" &&
    d.description.trim() === "" &&
    d.categoryId === null &&
    d.questions.every((q) => q.text.trim() === "" && q.options.every((o) => o.trim() === ""))
  );
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
    resultVisibility: "public",
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
// price: 응답 1명 받는 값 (등록비 = price × 목표 인원, 서버 calc_survey_price와 같은 구간)
export function estimate(
  d: SurveyDraft,
  rules: Record<string, number>,
): { minutes: number; reward: number; price: number } {
  const seconds = d.questions.reduce(
    (sum, q) => sum + (q.type === "text" ? rules.sec_per_text : rules.sec_per_choice),
    0,
  );
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  const band = d.questions.length === 1 ? "1q" : minutes < 5 ? "lt5" : minutes < 15 ? "5to15" : "gte15";
  return { minutes, reward: rules[`reward_${band}`], price: rules[`price_${band}`] };
}

// 등록비 (화면 표시용. 실제 차감은 서버). 단체는 cost_survey_create_org (테스트 동안 0)
export function registrationCost(d: SurveyDraft, rules: Record<string, number>, isOrg: boolean): number {
  if (isOrg) return rules.cost_survey_create_org;
  const target = Number(d.target);
  return Number.isInteger(target) ? estimate(d, rules).price * target : 0;
}

// create_survey에 보낼 문항 형식
export function toRpcQuestions(d: SurveyDraft) {
  return d.questions.map((q) =>
    isChoice(q.type)
      ? { type: q.type, text: q.text.trim(), options: q.options.map((o) => o.trim()) }
      : { type: q.type, text: q.text.trim() },
  );
}
