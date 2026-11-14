// 포인트 내역 불러오기 (포인트 내역 화면, 2026-11-10)
// point_ledger는 RLS로 본인 것만 읽힌다. 확정(confirmed)된 기록만, 최신순
// 2026-11-14 마이 탭 시안 ③: "기타" 없이 실제 사유로 (웰컴 미션 이름 · 미션 보너스 · 설문 등록 "목표 n명 × nP")
import { formatPoints } from "@/lib/format";
import { BONUS_LABELS, MISSION_LABELS } from "@/lib/missions";
import { supabase } from "@/lib/supabase";

export type LedgerItem = {
  id: number;
  amount: number;
  // 이유 (설문 응답 · 오늘의 질문 · 웰컴 미션 …)
  reason: string;
  // 한 줄 설명 (설문 제목 · 미션 이름 · "목표 10명 × 15P" …), 없으면 null
  detail: string | null;
  createdAt: string;
};

// 전체 · 적립(+) · 사용(-)
export type LedgerKind = "all" | "earn" | "spend";

// 포인트 기록 이유 → 화면 문구
const REASON_LABELS: Record<string, string> = {
  welcome: "가입 축하",
  survey_reward: "설문 응답",
  survey_create: "설문 등록",
  survey_refund: "설문 마감 환불",
  survey_delete: "설문 삭제 환불",
  data_view: "데이터 열람",
  data_share: "열람 수익",
  balance_vote: "밸런스 투표",
  daily_question: "오늘의 질문",
  streak_bonus: "오늘의 질문 연속 보너스",
  community: "커뮤니티 투표",
  creator_bonus: "내 투표 인기 보너스",
  invite: "친구 초대",
  mission: "웰컴 미션",
  mission_bonus: "웰컴 미션 보너스",
};

// ref_id가 설문 번호인 기록 ("12" 또는 열람 수익 "12:34")
const SURVEY_REASONS = new Set(["survey_reward", "survey_create", "survey_refund", "survey_delete", "data_view", "data_share"]);

function surveyIdOf(reason: string, refId: string | null): number | null {
  if (!SURVEY_REASONS.has(reason)) return null;
  const match = /^(\d+)(:\d+)?$/.exec(refId ?? "");
  return match ? Number(match[1]) : null;
}

type SurveyInfo = { title: string; target: number; price: number };

// offset부터 limit개 (설문 관련 기록에는 설문 제목을 붙인다)
export async function fetchLedger({
  offset = 0,
  limit,
  kind = "all",
}: {
  offset?: number;
  limit: number;
  kind?: LedgerKind;
}): Promise<LedgerItem[]> {
  let query = supabase
    .from("point_ledger")
    .select("id, amount, reason, ref_id, created_at")
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (kind === "earn") query = query.gt("amount", 0);
  if (kind === "spend") query = query.lt("amount", 0);
  const { data: rows } = await query.range(offset, offset + limit - 1);

  const surveyIds = (rows ?? []).map((r) => surveyIdOf(r.reason, r.ref_id)).filter((sid): sid is number => sid !== null);
  const surveys = new Map<number, SurveyInfo>();
  if (surveyIds.length > 0) {
    const { data: found } = await supabase
      .from("surveys")
      .select("id, title, target_responses, price_per_response")
      .in("id", surveyIds);
    (found ?? []).forEach((s) => surveys.set(s.id, { title: s.title, target: s.target_responses, price: s.price_per_response }));
  }

  return (rows ?? []).map((r) => {
    const sid = surveyIdOf(r.reason, r.ref_id);
    const survey = sid !== null ? surveys.get(sid) : undefined;
    let detail: string | null = survey?.title ?? null;
    if (r.reason === "survey_create" && survey && survey.price > 0) {
      detail = `${survey.title} · 목표 ${survey.target}명 × ${formatPoints(survey.price)}`;
    } else if (r.reason === "mission") {
      detail = MISSION_LABELS[r.ref_id ?? ""]?.short.replace(/\n/g, " ") ?? null;
    } else if (r.reason === "mission_bonus") {
      detail = BONUS_LABELS[r.ref_id ?? ""] ?? null;
    }
    return {
      id: r.id,
      amount: r.amount,
      reason: REASON_LABELS[r.reason] ?? "포인트 변동",
      detail,
      createdAt: r.created_at,
    };
  });
}

// 이번 달(이 기기 날짜 기준 1일부터) 모은 포인트 · 쓴 포인트
export async function fetchMonthSummary(): Promise<{ earned: number; spent: number }> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { data } = await supabase.from("point_ledger").select("amount").eq("status", "confirmed").gte("created_at", start);
  let earned = 0;
  let spent = 0;
  (data ?? []).forEach((r) => {
    if (r.amount > 0) earned += r.amount;
    else spent += -r.amount;
  });
  return { earned, spent };
}
