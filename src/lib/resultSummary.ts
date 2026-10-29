// 결과 핵심 요약: 정해진 규칙으로 문장을 만든다 (AI 요약은 출시 후 검토)
import { percent, type QuestionStats } from "@/components/results/QuestionResult";
import { type FullResults, GROUP_DIMS } from "@/lib/hub";

// 그룹 차이를 짚어 줄 최소 차이. 고르기는 %p, 척도는 점수 차이 × 25로 같은 눈금에 맞춘다
const MIN_GAP = 10;
const SCALE_TO_PCT = 25;

// 문항 한 줄: "가장 많은 답: 찬성 (62%)" / "평균 3.8점". 주관식·응답 없음은 null
export function questionLine(q: QuestionStats): string | null {
  if (q.answered === 0) return null;
  if (q.type === "scale") return q.scale?.avg != null ? `평균 ${q.scale.avg}점` : null;
  if (q.type === "single" || q.type === "multi") {
    const max = Math.max(0, ...q.options.map((o) => o.count));
    if (max === 0) return null;
    const tops = q.options.filter((o) => o.count === max).map((o) => o.text);
    return `가장 많은 답: ${tops.join(" · ")} (${percent(max, q.answered)}%)`;
  }
  return null;
}

// 그룹 차이가 가장 큰 곳: "3번 문항, 성별 차이가 가장 커요" + "‘찬성’ 남성 40% · 여성 70%"
// 비교할 그룹(숨김·미입력 제외)이 2개 이상일 때만
type Gap = { gap: number; title: string; detail: string };

export function biggestGap(full: FullResults): Gap | null {
  // 화살표 함수 안에서 바꾸므로 상자에 담아 둔다 (TypeScript가 null로만 보지 않게)
  const found: { best: Gap | null } = { best: null };

  for (const dim of GROUP_DIMS) {
    const groups = full.groups[dim.value].filter((g) => !g.hidden && !g.label.includes("미입력"));
    if (groups.length < 2) continue;

    full.overall.forEach((q, index) => {
      // 그룹마다 이 문항의 값 (고르기 = 보기별 %, 척도 = 평균)
      const rows = groups
        .map((g) => ({ label: g.label, stats: g.questions.find((x) => x.id === q.id) }))
        .filter((r): r is { label: string; stats: QuestionStats } => !!r.stats && r.stats.answered > 0);
      if (rows.length < 2) return;

      const consider = (gap: number, what: string, value: (s: QuestionStats) => number, unit: string) => {
        if (gap < MIN_GAP || (found.best && gap <= found.best.gap)) return;
        const sorted = [...rows].sort((a, b) => value(a.stats) - value(b.stats));
        const low = sorted[0];
        const high = sorted[sorted.length - 1];
        found.best = {
          gap,
          title: `${index + 1}번 문항, ${dim.label} 차이가 가장 커요`,
          detail: `${what}${low.label} ${value(low.stats)}${unit} · ${high.label} ${value(high.stats)}${unit}`,
        };
      };

      if (q.type === "scale") {
        const avg = (s: QuestionStats) => s.scale?.avg ?? 0;
        const values = rows.map((r) => avg(r.stats));
        consider((Math.max(...values) - Math.min(...values)) * SCALE_TO_PCT, "평균 ", avg, "점");
      } else if (q.type === "single" || q.type === "multi") {
        q.options.forEach((o) => {
          const pct = (s: QuestionStats) => percent(s.options.find((x) => x.id === o.id)?.count ?? 0, s.answered);
          const values = rows.map((r) => pct(r.stats));
          consider(Math.max(...values) - Math.min(...values), `‘${o.text}’ `, pct, "%");
        });
      }
    });
  }

  return found.best;
}

// 평균 응답 시간: 95 → "1분 35초"
export function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}
