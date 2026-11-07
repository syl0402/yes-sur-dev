// 설문 목록 불러오기·정렬·필터. 홈과 설문 탭이 같이 쓴다.
import { timeBandOf } from "@/lib/pointBands";
import { supabase } from "@/lib/supabase";
import type { Tag } from "@/lib/tags";

export type SurveyCard = {
  id: number;
  title: string;
  est_minutes: number;
  reward_points: number;
  target_responses: number;
  response_count: number;
  audience: "all" | "campus";
  closes_at: string | null;
  created_at: string;
  category_key: string;
  category_name: string;
  host_name: string | null;
  host_verified: boolean;
  tags: Tag[];
};

export type SortKey = "recommended" | "latest" | "closing" | "reward";
export type DurationKey = "all" | "le3" | "3to7" | "7to15" | "gte15";

// 남은 자리 (목표 응답 수 - 현재 응답 수)
export function remainingSpots(s: { target_responses: number; response_count: number }): number {
  return Math.max(s.target_responses - s.response_count, 0);
}

// 내가 지금 참여할 수 있는 설문: 진행 중 · 마감 전 · 자리 있음 · 응답 안 함 · 내 설문 아님
// (응답 대상이 아닌 설문은 DB 권한(RLS)에서 이미 빠진다)
export async function fetchOpenSurveys(): Promise<SurveyCard[]> {
  const { data: auth } = await supabase.auth.getUser();
  const myId = auth.user?.id;

  const [{ data: surveys }, { data: responses }] = await Promise.all([
    supabase
      .from("surveys")
      .select(
        "id, owner_id, title, est_minutes, reward_points, target_responses, response_count, audience, closes_at, created_at, host_name, host_verified, survey_categories(key, name), survey_tags(tags(id, name))",
      )
      .eq("status", "open")
      .or(`closes_at.is.null,closes_at.gt.${new Date().toISOString()}`),
    // 확인 문항을 틀려 반려된 응답은 다시 응답할 수 있으니 목록에 남긴다
    supabase.from("responses").select("survey_id").eq("status", "confirmed"),
  ]);

  const answered = new Set((responses ?? []).map((r) => r.survey_id));

  return (surveys ?? [])
    .filter((s) => !answered.has(s.id) && s.owner_id !== myId && s.response_count < s.target_responses)
    .map((s) => {
      // 카테고리는 설문 하나에 하나 (배열로 올 때와 객체로 올 때 모두 처리)
      const raw = s.survey_categories as unknown;
      const category = (Array.isArray(raw) ? raw[0] : raw) as { key: string; name: string } | null;
      return {
        id: s.id,
        title: s.title,
        est_minutes: s.est_minutes,
        reward_points: s.reward_points,
        target_responses: s.target_responses,
        response_count: s.response_count,
        audience: s.audience,
        closes_at: s.closes_at,
        created_at: s.created_at,
        category_key: category?.key ?? "",
        category_name: category?.name ?? "",
        host_name: s.host_name,
        host_verified: s.host_verified,
        tags: toTags(s.survey_tags),
      };
    });
}

// survey_tags(tags(id, name)) → Tag[] (연결 한 줄에 태그가 객체 또는 배열로 온다)
function toTags(raw: unknown): Tag[] {
  return ((raw as { tags: unknown }[] | null) ?? [])
    .map((st) => (Array.isArray(st.tags) ? st.tags[0] : st.tags) as Tag | null)
    .filter((t): t is Tag => !!t);
}

// 마감 시각 (없으면 맨 뒤로)
function closingTime(s: SurveyCard): number {
  return s.closes_at ? new Date(s.closes_at).getTime() : Number.MAX_SAFE_INTEGER;
}

// 정렬. 추천순 = 우리 학교 설문 먼저 → 마감 임박 → 남은 자리 적은 순 (2026-10-29 결정)
export function sortSurveys(list: SurveyCard[], key: SortKey): SurveyCard[] {
  const copy = [...list];
  switch (key) {
    case "latest":
      return copy.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case "closing":
      return copy.sort((a, b) => closingTime(a) - closingTime(b));
    case "reward":
      return copy.sort((a, b) => b.reward_points - a.reward_points);
    case "recommended":
      return copy.sort(
        (a, b) =>
          // 응답 목록에 보이는 우리 학교 설문은 모두 내 학교 설문이다
          Number(b.audience === "campus") - Number(a.audience === "campus") ||
          closingTime(a) - closingTime(b) ||
          remainingSpots(a) - remainingSpots(b),
      );
  }
}

// 소요시간 필터 (보상 구간과 같은 기준, 2026-11-03)
export function matchesDuration(s: SurveyCard, key: DurationKey): boolean {
  return key === "all" || timeBandOf(s.est_minutes) === key;
}

// 작성자 표시: 인증된 단체는 "단체 이름 ✓", 학생은 닉네임을 공개했으면 닉네임, 아니면 "옛썰러" (2026-11-02)
// 개인 설문 비공개 이름
export const ANONYMOUS_HOST = "옛썰러";

export function formatHost(s: { host_name: string | null; host_verified: boolean }): string {
  if (s.host_name && s.host_verified) return `${s.host_name} ✓`;
  return s.host_name ?? ANONYMOUS_HOST;
}
