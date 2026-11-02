// 커뮤니티 (ys-140~142). 서버 함수 모양은 docs/DB.md "커뮤니티"
import type { Href } from "expo-router";

import type { GroupDim } from "@/lib/hub";
import { supabase } from "@/lib/supabase";

export type PostKind = "balance" | "relate" | "pick" | "promo";

export const KIND_LABELS: Record<PostKind, string> = {
  balance: "밸런스",
  relate: "나만 그래?",
  pick: "골라 줘",
  promo: "설문 홍보",
};

// 만들기 화면의 종류 설명
export const KIND_HINTS: Record<PostKind, string> = {
  balance: "둘 중 하나! 예: 짜장 vs 짬뽕",
  relate: "공감 투표. 예: 시험 전날에만 방 청소하고 싶어진다",
  pick: "보기 2~4개 중 골라 달라고 하기. 예: 노트북 뭐 살까?",
  promo: "내가 올린 진행 중인 설문을 소개하고 응답을 부탁하기 (설문 하나에 한 번)",
};

export type PostSort = "popular" | "latest";

export const POST_SORT_OPTIONS: { value: PostSort; label: string }[] = [
  { value: "popular", label: "인기순" },
  { value: "latest", label: "최신순" },
];

// 그룹 하나 (n이 null이면 5명 미만이라 숨김)
export type PostGroup = { label: string; n: number | null; hidden: boolean; counts: number[] | null };

// 홍보글에 붙는 설문 정보 (보는 사람 기준 응답 여부)
export type PromoSurvey = {
  id: number;
  title: string;
  reward: number;
  minutes: number;
  questions: number;
  remaining: number;
  closes_at: string | null;
  open: boolean;
  answered: boolean;
};

// get_school_ranking: 이번 주 학교 대항전 (활동한 학생이 적은 학교는 빠져서 옴, 2026-11-02)
export type SchoolRanking = {
  week_start: string;
  ranking: { school: string; count: number; rank: number }[];
  my_school: string | null;
  my_rank: number | null;
};

// get_weekly_best: HOT 게시판 한 줄 (글 + 월드컵, 작성자 정보 없음, 2026-11-03). 월드컵은 votes = 최근 참여 수
export type HotItem = {
  type: "post" | "worldcup";
  id: number;
  kind: PostKind | "worldcup";
  question: string;
  votes: number;
  comment_count: number;
};

export async function fetchHot(): Promise<HotItem[]> {
  const { data, error } = await supabase.rpc("get_weekly_best");
  if (error) throw error;
  return (data as HotItem[] | null) ?? [];
}

// HOT 한 줄을 누르면 갈 곳
export function hotHref(h: HotItem): Href {
  return h.type === "worldcup"
    ? { pathname: "/community/worldcup/[id]", params: { id: String(h.id) } }
    : { pathname: "/community/[id]", params: { id: String(h.id) } };
}

// get_feed 한 줄 / get_post (counts·groups는 투표했거나 내 글일 때만, survey는 홍보글만)
export type Post = {
  id: number;
  kind: PostKind;
  question: string;
  // 본문 (선택)
  body: string | null;
  options: string[];
  author: string;
  mine: boolean;
  created_at: string;
  votes: number;
  comment_count: number;
  survey?: PromoSurvey | null;
  my_choice: number | null;
  counts: number[] | null;
  groups?: Record<GroupDim, PostGroup[]> | null;
};

// 댓글 대상: 커뮤니티 글 / 지난 오늘의 질문
export type CommentTarget = "post" | "daily" | "worldcup";

// get_comments 한 줄. author: 익명1·익명(글쓴이)·닉네임·단체 이름 (2026-11-03)
// deleted: 지운 원댓글인데 답글이 있어서 자리만 남은 것 (본문·이름은 빈칸)
export type Comment = {
  id: number;
  parent_id: number | null;
  deleted: boolean;
  body: string;
  author: string;
  mine: boolean;
  likes: number;
  liked: boolean;
  created_at: string;
  // 원댓글에만 (답글 목록)
  replies?: Comment[];
};

// 익명으로 쓸 수 있는지 (운영자가 아닌 학생만. 서버도 한 번 더 막는다)
export async function fetchCanAnonymous(): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("account_type, role").maybeSingle();
  return data?.account_type === "student" && data?.role !== "admin";
}

// 본문·댓글 글자 수 (서버와 같은 규칙)
export const POST_BODY_MAX = 500;
export const COMMENT_MAX = 200;
