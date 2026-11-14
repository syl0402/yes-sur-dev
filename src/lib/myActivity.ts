// 마이 탭 "내 데이터" · "커뮤니티" 묶음 데이터 (2026-11-14 마이 탭 시안). 모두 본인 것만
// - fetchMyDataRows: 응답한 · 스크랩 · 열람한 결과 (get_hub_list · get_my_bookmarks · get_my_views)
// - fetchMyCommunity: 내 글 · 내 댓글 · 내가 참여한 투표 (get_my_posts · get_my_comments · get_my_participation)
import type { CommentTarget, PostKind } from "@/lib/community";
import { formatPoints, formatShortDate } from "@/lib/format";
import type { HubItem } from "@/lib/hub";
import { supabase } from "@/lib/supabase";

// ---------- 내 데이터 ----------
export type DataTab = "answered" | "saved" | "viewed";
export type DataRow = { id: number; title: string; sub: string; at: string };

type MyView = { survey_id: number; title: string; viewed_at: string; paid: number };

export async function fetchMyDataRows(): Promise<Record<DataTab, DataRow[]>> {
  const [hub, marks, views] = await Promise.all([
    supabase.rpc("get_hub_list", { p_category: null, p_sort: "latest" }),
    supabase.rpc("get_my_bookmarks"),
    supabase.rpc("get_my_views"),
  ]);
  const items = (hub.data as HubItem[] | null) ?? [];
  const saved = (marks.data as number[] | null) ?? [];
  const toRow = (i: HubItem): DataRow => ({
    id: i.id,
    title: i.title,
    sub: `${i.category_name} · ${formatShortDate(i.ended_at)} 마감 · 응답 ${i.response_count}명`,
    at: i.ended_at,
  });
  return {
    answered: items.filter((i) => i.answered).map(toRow),
    saved: items.filter((i) => saved.includes(i.id)).map(toRow),
    viewed: ((views.data as MyView[] | null) ?? []).map((v) => ({
      id: v.survey_id,
      title: v.title,
      sub: `${formatShortDate(v.viewed_at)} 열람 · ${v.paid > 0 ? formatPoints(v.paid) : "무료"}`,
      at: v.viewed_at,
    })),
  };
}

// ---------- 커뮤니티 ----------
export type Moderation = "visible" | "hidden" | "removed";

// get_my_posts 한 줄
export type MyPost = {
  id: number;
  kind: PostKind;
  question: string;
  moderation: Moderation;
  created_at: string;
  votes: number;
  comment_count: number;
};

// get_my_comments 한 줄. today: 오늘의 질문이 오늘 것인지 (지난 질문은 갈 화면이 없다)
export type MyComment = {
  id: number;
  body: string;
  moderation: Moderation;
  created_at: string;
  target_type: CommentTarget;
  target_id: number;
  target_title: string | null;
  today: boolean;
};

// get_my_participation 한 줄: 내가 투표한 글 · 답한 오늘의 질문 · 한 월드컵 + 내가 고른 답
export type MyVote = {
  type: "post" | "daily" | "worldcup";
  id: number;
  kind: PostKind | null;
  title: string;
  choice: string | null;
  created_at: string;
};

export type MyCommunity = { posts: MyPost[]; comments: MyComment[]; votes: MyVote[] };

export async function fetchMyCommunity(): Promise<MyCommunity> {
  const [p, c, v] = await Promise.all([
    supabase.rpc("get_my_posts"),
    supabase.rpc("get_my_comments"),
    supabase.rpc("get_my_participation"),
  ]);
  return {
    posts: (p.data as MyPost[] | null) ?? [],
    comments: (c.data as MyComment[] | null) ?? [],
    votes: (v.data as MyVote[] | null) ?? [],
  };
}
