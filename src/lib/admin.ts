// 운영자 화면 (ys-180 · F-704). 서버 함수는 20261031000003_admin.sql — 모두 서버에서 운영자인지 다시 확인한다
import { supabase } from "@/lib/supabase";

export type AdminCounts = { reports: number; feedback: number; orgs: number };

// 신고 대상 하나 (같은 대상의 확인 전 신고를 묶은 것)
export type ReportGroup = {
  type: "survey" | "post" | "comment";
  id: number;
  count: number;
  reasons: string[];
  details: string[] | null;
  last_at: string;
  title: string | null;
  body: string | null;
  options: string[] | null;
  // visible 보이는 중 · hidden 신고로 자동 숨김 · removed 운영자 삭제 · deleted 작성자가 지움
  moderation: string | null;
  // 댓글이 달린 곳
  parent_type: "post" | "daily" | null;
  parent_id: number | null;
};

export const REPORT_TYPE_LABELS: Record<ReportGroup["type"], string> = {
  survey: "설문",
  post: "글",
  comment: "댓글",
};

// 신고 사유 (report.tsx 선택지와 같은 이름)
export const REPORT_REASON_LABELS: Record<string, string> = {
  spam: "스팸·광고",
  abuse: "욕설·혐오",
  privacy: "개인정보 요구",
  sexual: "성적인 내용",
  other: "기타",
};

// 운영자면 대기 건수, 아니면 null (마이 탭 운영 카드용)
export async function fetchAdminCounts(): Promise<AdminCounts | null> {
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) return null;
  const { data } = await supabase.rpc("admin_get_counts");
  return (data as AdminCounts | null) ?? { reports: 0, feedback: 0, orgs: 0 };
}

export function totalPending(c: AdminCounts): number {
  return c.reports + c.feedback + c.orgs;
}
