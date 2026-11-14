// 내가 올린 설문 목록 (마이 홈 · 내 설문 전체가 같이 쓴다, 2026-11-14 마이 탭 시안)
// 데이터 탭에 공개됐는지·열람 수는 데이터 탭과 같은 get_hub_list에서 mine인 것. 모두 본인 것만 읽힌다
import type { HubItem } from "@/lib/hub";
import { supabase } from "@/lib/supabase";
import type { ResultVisibility } from "@/lib/surveyDraft";

export type MySurvey = {
  id: number;
  title: string;
  responseCount: number;
  target: number;
  closed: boolean;
  // 신고로 숨겨짐(운영자 확인 중) 또는 운영자가 삭제
  moderated: boolean;
  // 데이터 탭에 공개된 결과면 열람 수, 아니면 null
  hubViews: number | null;
  createdAt: string;
  visibility: ResultVisibility;
};

export async function fetchMySurveys(userId: string): Promise<MySurvey[]> {
  if (!userId) return [];
  const [{ data }, { data: hub }] = await Promise.all([
    supabase
      .from("surveys")
      .select("id, title, response_count, target_responses, status, closes_at, moderation, created_at, result_visibility")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    supabase.rpc("get_hub_list", { p_category: null, p_sort: "latest" }),
  ]);
  const hubViews = new Map(((hub as HubItem[] | null) ?? []).filter((h) => h.mine).map((h) => [h.id, h.view_count]));
  const now = Date.now();
  return (data ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    responseCount: s.response_count,
    target: s.target_responses,
    closed: s.status !== "open" || (s.closes_at !== null && new Date(s.closes_at).getTime() <= now),
    moderated: s.moderation !== "visible",
    createdAt: s.created_at,
    visibility: s.result_visibility,
    hubViews: hubViews.get(s.id) ?? null,
  }));
}
