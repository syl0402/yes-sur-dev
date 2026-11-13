// 결과 카드 이미지에 들어갈 내용 (2026-11-14 데이터 허브 시안 CardStory · CardSquare)
// 수치는 모두 실제 결과(get_full_results)에서. 응답이 적은 묶음(point_rules low_response_warning 미만)은 카드 차트에서 뺀다
import { percent, type QuestionStats } from "@/components/results/QuestionResult";
import { type FullResults, GROUP_DIMS, type GroupDim } from "@/lib/hub";

// 카드 막대 한 줄
export type CardRow = { label: string; value: number };

// 인사이트 카드 (스토리 9:16): 큰 문장 한 줄 + 근거 차트 하나
export type StoryData = {
  question: string;
  // 큰 문장: 앞 · 강조 숫자(라임) · 뒤 (예: "공학 계열 " · "80%" · "는 ‘안 해 봤어요’")
  headline: { before: string; strong: string; after: string };
  chartTitle: string;
  chartSub: string;
  rows: CardRow[];
  unit: "%" | "점";
  // 전체 평균 (묶음 비교일 때만)
  overall: number | null;
};

// 문항 카드 (정사각 1:1)
export type SquareData = { question: string; rows: CardRow[] };

const DIM_SUFFIX: Partial<Record<GroupDim, string>> = { major: " 계열" };
const MAX_STORY_ROWS = 5;
const MAX_SQUARE_ROWS = 4;
// 묶음 비교로 보여 줄 최소 차이 (결과 화면 인사이트와 같은 기준: 고르기 %p, 척도는 점수 × 25)
const MIN_GAP = 10;
const SCALE_TO_PCT = 25;

type Candidate = { gap: number; data: StoryData };

// 묶음 차이가 가장 큰 문항·답 (결과 화면 인사이트 "n번 문항, 계열 차이가 가장 커요"와 같은 규칙)
// 미입력·숨김·응답이 적은 묶음은 빼고, 남은 묶음이 2개 이상일 때만
function biggestGroupChart(full: FullResults, fewUnder: number): StoryData | null {
  const candidates: Candidate[] = [];

  for (const dim of GROUP_DIMS) {
    const groups = full.groups[dim.value].filter(
      (g) => !g.hidden && !g.label.includes("미입력") && (g.n ?? 0) >= fewUnder,
    );
    if (groups.length < 2) continue;
    const suffix = DIM_SUFFIX[dim.value] ?? "";

    for (const q of full.overall) {
      const rows = groups
        .map((g) => ({ label: g.label, stats: g.questions.find((x) => x.id === q.id) }))
        .filter((r): r is { label: string; stats: QuestionStats } => !!r.stats && r.stats.answered > 0);
      if (rows.length < 2) continue;

      if (q.type === "scale") {
        const values = rows
          .map((r) => ({ label: r.label, value: r.stats.scale?.avg ?? 0 }))
          .sort((a, b) => b.value - a.value);
        candidates.push({
          gap: (values[0].value - values[values.length - 1].value) * SCALE_TO_PCT,
          data: {
            question: q.text,
            headline: { before: `${values[0].label}${suffix} 평균 `, strong: `${values[0].value}점`, after: "으로 가장 높아요" },
            chartTitle: "평균 점수",
            chartSub: `${dim.label}별`,
            rows: values.slice(0, MAX_STORY_ROWS),
            unit: "점",
            overall: q.scale?.avg ?? null,
          },
        });
      } else if (q.type === "single" || q.type === "multi") {
        for (const o of q.options) {
          const values = rows
            .map((r) => ({
              label: r.label,
              value: percent(r.stats.options.find((x) => x.id === o.id)?.count ?? 0, r.stats.answered),
            }))
            .sort((a, b) => b.value - a.value);
          candidates.push({
            gap: values[0].value - values[values.length - 1].value,
            data: {
              question: q.text,
              headline: { before: `${values[0].label}${suffix} `, strong: `${values[0].value}%`, after: `는\n‘${o.text}’` },
              chartTitle: `‘${o.text}’ 비율`,
              chartSub: `${dim.label}별`,
              rows: values.slice(0, MAX_STORY_ROWS),
              unit: "%",
              overall: percent(o.count, q.answered),
            },
          });
        }
      }
    }
  }

  const best = candidates.sort((a, b) => b.gap - a.gap)[0];
  return best && best.gap >= MIN_GAP ? best.data : null;
}

// 인사이트 카드 내용: 묶음 차이가 뚜렷하면 그것, 아니면 1위 답이 가장 뚜렷한 고르기 문항의 전체 결과
export function buildStoryData(full: FullResults, fewUnder: number): StoryData | null {
  const group = biggestGroupChart(full, fewUnder);
  if (group) return group;

  const best = full.overall
    .filter((q) => (q.type === "single" || q.type === "multi") && q.answered > 0 && q.options.length >= 2)
    .map((q) => {
      const sorted = [...q.options].sort((a, b) => b.count - a.count);
      return { q, sorted, top: percent(sorted[0].count, q.answered) };
    })
    .sort((a, b) => b.top - a.top)[0];
  if (!best) return null;

  return {
    question: best.q.text,
    headline: { before: "응답자 ", strong: `${best.top}%`, after: `가\n‘${best.sorted[0].text}’` },
    chartTitle: "전체 응답",
    chartSub: best.q.type === "multi" ? "여러 개 고르기" : "하나 고르기",
    rows: best.sorted.slice(0, MAX_STORY_ROWS).map((o) => ({ label: o.text, value: percent(o.count, best.q.answered) })),
    unit: "%",
    overall: null,
  };
}

// 문항 카드에 쓸 수 있는 문항 (주관식 제외, 답한 사람이 있는 것)
export function squareQuestions(full: FullResults): { index: number; q: QuestionStats }[] {
  return full.overall.map((q, index) => ({ index, q })).filter(({ q }) => q.type !== "text" && q.answered > 0);
}

// 문항 카드 내용
// - 고르기: 큰 순서 상위 4개. 하나 고르기에서 보기가 5개 넘으면 상위 3개 + "그 외"
// - 척도: 3묶음 (그래요 4~5점 · 보통 3점 · 아니에요 1~2점)
export function buildSquareData(q: QuestionStats): SquareData {
  if (q.type === "scale") {
    const c = q.scale?.counts ?? [0, 0, 0, 0, 0];
    return {
      question: q.text,
      rows: [
        { label: "그래요 (4~5점)", value: percent(c[3] + c[4], q.answered) },
        { label: "보통 (3점)", value: percent(c[2], q.answered) },
        { label: "아니에요 (1~2점)", value: percent(c[0] + c[1], q.answered) },
      ],
    };
  }
  const sorted = [...q.options].sort((a, b) => b.count - a.count);
  const row = (o: { text: string; count: number }) => ({ label: o.text, value: percent(o.count, q.answered) });
  if (q.type === "single" && sorted.length > MAX_SQUARE_ROWS + 1) {
    const rest = sorted.slice(MAX_SQUARE_ROWS - 1).reduce((sum, o) => sum + o.count, 0);
    return {
      question: q.text,
      rows: [...sorted.slice(0, MAX_SQUARE_ROWS - 1).map(row), { label: "그 외", value: percent(rest, q.answered) }],
    };
  }
  return { question: q.text, rows: sorted.slice(0, MAX_SQUARE_ROWS).map(row) };
}
