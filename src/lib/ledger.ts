// 포인트 내역 불러오기 (마이 탭 최근 내역 · 포인트 내역 전체 화면이 같이 쓴다, 2026-11-10)
// point_ledger는 RLS로 본인 것만 읽힌다. 확정(confirmed)된 기록만, 최신순
import { supabase } from "@/lib/supabase";

export type LedgerItem = {
  id: number;
  amount: number;
  // 이유 (설문 응답 · 오늘의 질문 …)
  reason: string;
  // 설문 관련이면 설문 제목
  title: string | null;
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
  streak_bonus: "연속 출석 보너스",
  community: "커뮤니티 투표",
  creator_bonus: "내 투표 인기 보너스",
  invite: "친구 초대",
};

// 기록의 ref_id에서 설문 번호 ("12" 또는 열람 수익 "12:34"). 개발용 기록("dev-…")은 null
function surveyIdOf(refId: string | null): number | null {
  const match = /^(\d+)(:\d+)?$/.exec(refId ?? "");
  return match ? Number(match[1]) : null;
}

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

  const surveyIds = (rows ?? []).map((r) => surveyIdOf(r.ref_id)).filter((sid): sid is number => sid !== null);
  const titles = new Map<string, string>();
  if (surveyIds.length > 0) {
    const { data: found } = await supabase.from("surveys").select("id, title").in("id", surveyIds);
    (found ?? []).forEach((s) => titles.set(String(s.id), s.title));
  }

  return (rows ?? []).map((r) => {
    const sid = surveyIdOf(r.ref_id);
    return {
      id: r.id,
      amount: r.amount,
      reason: REASON_LABELS[r.reason] ?? "기타",
      title: (sid !== null ? titles.get(String(sid)) : undefined) ?? null,
      createdAt: r.created_at,
    };
  });
}
