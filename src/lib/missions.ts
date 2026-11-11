// 웰컴 14일 미션 (2026-11-12). 서버 함수 모양은 supabase/migrations/20261112000001_welcome_missions.sql
// 앱은 "보상 받기"만 요청한다. 완료 여부와 금액은 서버가 정한다
import type { Href } from "expo-router";

import type { IconName } from "@/constants/icons";

import { supabase } from "@/lib/supabase";

// locked: 아직 안 열림 · open: 열림(아직 안 함) · ready: 보상 받기 가능 · done: 받음
export type MissionStatus = "locked" | "open" | "ready" | "done";

export type Mission = {
  code: string;
  day: number;
  title: string;
  description: string;
  href: string;
  target: number;
  progress: number;
  reward: number;
  unlock_in: number;
  status: MissionStatus;
};

export type MissionBonus = { code: "bonus_week" | "bonus_all"; reward: number; done: boolean };

export type MyMissions = {
  started_on: string | null;
  today_day: number;
  earned: number;
  total: number;
  missions: Mission[];
  bonuses: MissionBonus[];
};

export type ClaimResult = { reward: number; bonuses: { code: string; amount: number }[] };

export const BONUS_LABELS: Record<string, string> = {
  bonus_week: "1주 완주 보너스",
  bonus_all: "14일 완주 보너스",
};

// 미션 기간 (일). 이 날이 지나면 홈 띠를 숨긴다
export const MISSION_DAYS = 14;

// 화면을 열면 시작(처음 한 번) → 목록. 학생이 아니면 시작하지 않고 목록만 (화면에서 안내)
export async function loadMissions(): Promise<MyMissions> {
  const { data: profile } = await supabase.from("profiles").select("account_type").maybeSingle();
  if (profile?.account_type === "student") {
    const { error } = await supabase.rpc("start_missions");
    if (error) throw error;
  }
  const { data, error } = await supabase.rpc("get_my_missions");
  if (error) throw error;
  return data as MyMissions;
}

export async function claimMission(code: string): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc("claim_mission", { p_code: code });
  if (error) throw error;
  return data as ClaimResult;
}

// 서버가 주는 화면 주소 (missions.href)
export function missionHref(m: Mission): Href {
  return m.href as Href;
}

// 홈에서 쓰는 목록 (미션을 시작시키지 않고 읽기만. 시작 전이면 started_on = null, 1일차로 보임)
export async function fetchMyMissions(): Promise<MyMissions | null> {
  const { data, error } = await supabase.rpc("get_my_missions");
  if (error) return null;
  return data as MyMissions;
}

// 미션 기간 중인지: 14일이 안 지났고 아직 다 받지 않음
export function isMissionActive(m: MyMissions | null): boolean {
  if (!m || m.missions.length === 0) return false;
  if (m.today_day > MISSION_DAYS) return false;
  return m.missions.some((x) => x.status !== "done");
}

// 오늘 열린 미션 (오늘 일차의 미션)
export function todayMission(m: MyMissions): Mission | undefined {
  return m.missions.find((x) => x.day === m.today_day);
}

export function doneCount(m: MyMissions): number {
  return m.missions.filter((x) => x.status === "done").length;
}

// 조건을 채웠지만 아직 안 받은 미션 → 화면에 오면 자동으로 받는다 (2026-11-12 결정: 자동 지급 + 완료 팝업)
// 서버가 조건·열림·중복을 다시 확인하므로 앱은 요청만 한다. 받은 것만 돌려준다
export async function claimReadyMissions(m: MyMissions): Promise<{ mission: Mission; result: ClaimResult }[]> {
  const claimed: { mission: Mission; result: ClaimResult }[] = [];
  for (const mission of m.missions.filter((x) => x.status === "ready")) {
    try {
      claimed.push({ mission, result: await claimMission(mission.code) });
    } catch {
      // 이미 받았거나 조건이 바뀐 경우: 다음 새로고침에 맞게 보인다
    }
  }
  return claimed;
}

// 미션 길 칸에 쓰는 짧은 이름 · 분류 (서버 code 기준, 2026-11-12 디자인 시안).
// 표에 없는 새 미션은 서버 제목을 그대로 쓴다
export const MISSION_LABELS: Record<string, { cat: string; short: string }> = {
  quiz: { cat: "OX퀴즈", short: "옛썰\n알아보기" },
  daily_1: { cat: "오늘의 질문", short: "오늘의 질문\n답하기" },
  survey_1: { cat: "설문 참여", short: "첫 설문\n참여하기" },
  about_me: { cat: "프로필", short: "나에 대해\n알려 주세요" },
  vote_1: { cat: "커뮤니티", short: "투표\n참여하기" },
  data_view_1: { cat: "데이터 허브", short: "설문 결과\n열람하기" },
  survey_2: { cat: "설문 참여", short: "설문 2개\n참여하기" },
  worldcup_1: { cat: "커뮤니티", short: "월드컵\n참여하기" },
  post_1: { cat: "커뮤니티", short: "글\n써 보기" },
  comment_1: { cat: "커뮤니티", short: "댓글\n남기기" },
  survey_create_1: { cat: "설문 등록", short: "내 설문\n올려 보기" },
  survey_3: { cat: "설문 참여", short: "설문 3개\n참여하기" },
  daily_3: { cat: "오늘의 질문", short: "오늘의 질문\n3번 답하기" },
  feedback_1: { cat: "마이", short: "의견\n보내기" },
};

// 분류별 아이콘 (완료 팝업 "내일 열리는 미션" 상자)
export const CATEGORY_ICONS: Record<string, IconName> = {
  OX퀴즈: "help-circle",
  "오늘의 질문": "chatbubble-ellipses",
  "설문 참여": "fig-document",
  프로필: "fig-person",
  커뮤니티: "fig-chat",
  "데이터 허브": "fig-poll",
  "설문 등록": "fig-pen",
  마이: "mail",
};

export function missionLabel(m: Mission): { cat: string; short: string } {
  return MISSION_LABELS[m.code] ?? { cat: `DAY ${m.day}`, short: m.title };
}

// "오늘 하루 보지 않기" (계정마다, 이 폰에만. 저장 방식은 첫 사용 안내와 같은 localStorage)
function todayKst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
const offKey = (userId: string) => `mission_off:${userId}`;

export function isMissionOffToday(userId: string): boolean {
  try {
    return localStorage.getItem(offKey(userId)) === todayKst();
  } catch {
    return true;
  }
}

export function setMissionOffToday(userId: string) {
  try {
    localStorage.setItem(offKey(userId), todayKst());
  } catch {
    // 저장 실패는 무시 (다음에 앱을 켜면 한 번 더 뜰 뿐)
  }
}

// 상세 바텀시트: 해 보는 방법 3단계 + 버튼 글자 (2026-11-12 디자인 시안 Sheet.dc.html). 표에 없는 미션은 기본 문구
export const MISSION_GUIDES: Record<string, { steps: [string, string, string]; cta: string }> = {
  quiz: { steps: ["OX 문제 5개를 읽어요", "O 또는 X를 골라요", "모두 맞히면 미션 완료!"], cta: "퀴즈 풀러 가기" },
  daily_1: { steps: ["오늘의 질문을 읽어요", "둘 중 하나를 골라요", "답하면 미션 완료!"], cta: "답하러 가기" },
  survey_1: { steps: ["설문 탭에서 관심 가는 설문을 골라요", "끝까지 성실하게 응답해요", "제출하면 미션 완료!"], cta: "설문 보러 가기" },
  about_me: { steps: ["관심 카테고리를 골라요", "생활 정보도 골라요 (선택)", "저장하면 미션 완료!"], cta: "알려 주러 가기" },
  vote_1: { steps: ["커뮤니티 탭에서 투표를 골라요", "궁금한 질문을 하나 열어요", "하나를 선택하면 미션 완료!"], cta: "투표하러 가기" },
  data_view_1: { steps: ["데이터 탭에서 결과를 골라요", "무료 결과나 포인트로 열람해요", "결과를 열면 미션 완료!"], cta: "결과 보러 가기" },
  survey_2: { steps: ["설문 탭에서 설문을 골라요", "끝까지 성실하게 응답해요", "응답한 설문이 2개가 되면 완료!"], cta: "설문 보러 가기" },
  worldcup_1: { steps: ["커뮤니티 탭에서 월드컵을 골라요", "끝까지 하나씩 골라요", "우승을 정하면 미션 완료!"], cta: "월드컵 하러 가기" },
  post_1: { steps: ["글 쓰기 화면을 열어요", "밸런스·골라 줘 같은 투표를 만들어요", "올리면 미션 완료!"], cta: "글 쓰러 가기" },
  comment_1: { steps: ["커뮤니티 글이나 오늘의 질문을 열어요", "하고 싶은 말을 적어요", "댓글을 달면 미션 완료!"], cta: "댓글 달러 가기" },
  survey_create_1: { steps: ["설문 등록 화면을 열어요", "질문을 만들고 대상을 정해요", "등록하면 미션 완료! (보상이 등록비보다 커요)"], cta: "설문 만들러 가기" },
  survey_3: { steps: ["설문 탭에서 설문을 골라요", "끝까지 성실하게 응답해요", "응답한 설문이 3개가 되면 완료!"], cta: "설문 보러 가기" },
  daily_3: { steps: ["오늘의 질문에 답해요", "하루에 한 번, 연속이 아니어도 돼요", "모두 3번 답하면 미션 완료!"], cta: "답하러 가기" },
  feedback_1: { steps: ["의견 보내기 화면을 열어요", "불편한 점이나 바라는 점을 적어요", "보내면 미션 완료!"], cta: "의견 보내러 가기" },
};

export function missionGuide(m: Mission): { steps: [string, string, string]; cta: string } {
  return MISSION_GUIDES[m.code] ?? { steps: ["아래 버튼을 눌러요", "미션 내용을 해요", "돌아오면 미션 완료!"], cta: "하러 가기" };
}
