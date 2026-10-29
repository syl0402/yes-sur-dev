// 데이터 허브 (ys-130·131). 서버 함수 모양은 docs/DB.md "데이터 허브"
import type { QuestionStats } from "@/components/results/QuestionResult";
import type { QuestionType } from "@/lib/surveyDraft";

export type HubSort = "popular" | "latest" | "responses";

export const HUB_SORT_OPTIONS: { value: HubSort; label: string }[] = [
  { value: "popular", label: "인기순" },
  { value: "latest", label: "최신순" },
  { value: "responses", label: "응답 많은 순" },
];

// get_hub_list 한 줄
export type HubItem = {
  id: number;
  title: string;
  host_name: string | null;
  host_verified: boolean;
  category_key: string;
  category_name: string;
  response_count: number;
  view_count: number;
  ended_at: string;
  viewed: boolean;
  answered: boolean;
  free: boolean;
  trusted: boolean;
  low_count: boolean;
};

// 나눠 보기 기준
export type GroupDim = "major" | "grade" | "gender" | "age";

export const GROUP_DIMS: { value: GroupDim; label: string }[] = [
  { value: "major", label: "계열" },
  { value: "grade", label: "학년" },
  { value: "gender", label: "성별" },
  { value: "age", label: "나이대" },
];

// 그룹 하나 (n이 null이면 5명 미만이라 숨김)
export type Group = { label: string; n: number | null; hidden: boolean; questions: QuestionStats[] };

// get_hub_preview
export type HubPreview = {
  id: number;
  title: string;
  description: string | null;
  host_name: string | null;
  host_verified: boolean;
  category_name: string;
  response_count: number;
  started_at: string;
  ended_at: string;
  questions: { text: string; type: QuestionType }[];
  composition: Record<GroupDim, Group[]>;
  mine: boolean;
  viewed: boolean;
  answered: boolean;
  // 열람하면 공짜인 이유. null이면 포인트 필요
  free_reason: "one_question" | "official" | "org" | "welcome" | null;
  price: number;
  trusted: boolean;
  low_count: boolean;
};

// get_my_comparison 한 줄
export type Comparison = { text: string; type: QuestionType; mine: (string | number)[]; same_pct: number[] };

// get_full_results
export type FullResults = {
  total: number;
  excluded: number;
  pass_rate: number | null;
  avg_seconds: number | null;
  started_at: string;
  ended_at: string;
  view_count: number;
  share_earned: number | null;
  overall: QuestionStats[];
  groups: Record<GroupDim, Group[]>;
};

// 무료로 열람하는 이유 → 버튼 문구
export const FREE_REASON_LABELS: Record<NonNullable<HubPreview["free_reason"]>, string> = {
  one_question: "1문항 설문이라 무료",
  official: "옛썰 공식 설문이라 무료",
  org: "단체 계정은 테스트 기간 무료",
  welcome: "첫 열람 1회 무료",
};

// 그룹 표시 순서 (서버는 이름순으로 보내서 앱이 다시 정렬)
const GROUP_ORDER: Record<GroupDim, string[]> = {
  major: ["인문", "사회", "교육", "공학", "자연", "의약", "예체능", "미입력"],
  grade: ["1~2학년", "3~4학년", "5학년 이상", "대학원", "미입력"],
  gender: ["남성", "여성", "선택 안 함·미입력"],
  age: ["20세 이하", "21~23세", "24~26세", "27세 이상", "미입력"],
};

export function sortGroups(dim: GroupDim, groups: Group[]): Group[] {
  const order = GROUP_ORDER[dim];
  const rank = (label: string) => (order.indexOf(label) === -1 ? order.length : order.indexOf(label));
  return [...groups].sort((a, b) => rank(a.label) - rank(b.label));
}
