// 결과 핵심 인사이트: 정해진 규칙으로 문장을 만든다 (AI 요약은 출시 후 검토)
import { percent, type QuestionStats } from "@/components/results/QuestionResult";
import { type FullResults, GROUP_DIMS } from "@/lib/hub";

// 그룹 차이를 짚어 줄 최소 차이. 고르기는 %p, 척도는 점수 차이 × 25로 같은 눈금에 맞춘다
const MIN_GAP = 10;
const SCALE_TO_PCT = 25;

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

// 인사이트 카드 한 줄
export type Insight = { emoji: string; title: string; detail: string };

// 한 문항이 압도적이라고 볼 1위 비율(%) · 팽팽하다고 볼 1·2위 차이(%p) · 카드 최대 개수
const DOMINANT_PCT = 60;
const CLOSE_GAP = 10;
const MAX_INSIGHTS = 4;

// 핵심 인사이트 (최대 4개): 압도적인 답 · 팽팽한 문항 · 그룹 차이 · 척도 최고/최저. 결과가 없으면 빈 배열
export function buildInsights(full: FullResults): Insight[] {
  const list: Insight[] = [];
  const label = (index: number, q: QuestionStats) => `${index + 1}번 · ${q.text}`;

  // 하나 고르기 문항의 1·2위
  const singles = full.overall
    .map((q, index) => ({ q, index }))
    .filter(({ q }) => q.type === "single" && q.answered > 0 && q.options.length >= 2)
    .map(({ q, index }) => {
      const sorted = [...q.options].sort((a, b) => b.count - a.count);
      return { q, index, first: sorted[0], second: sorted[1], p1: percent(sorted[0].count, q.answered), p2: percent(sorted[1].count, q.answered) };
    });

  const dominant = [...singles].filter((s) => s.p1 >= DOMINANT_PCT).sort((a, b) => b.p1 - a.p1)[0];
  if (dominant) {
    list.push({ emoji: "💡", title: `응답자 ${dominant.p1}%가 ‘${dominant.first.text}’`, detail: label(dominant.index, dominant.q) });
  }

  const close = [...singles]
    .filter((s) => s !== dominant && s.p1 - s.p2 <= CLOSE_GAP && s.second.count > 0)
    .sort((a, b) => a.p1 - a.p2 - (b.p1 - b.p2))[0];
  if (close) {
    list.push({
      emoji: "⚖️",
      title: `의견이 팽팽해요 · ‘${close.first.text}’ ${close.p1}% vs ‘${close.second.text}’ ${close.p2}%`,
      detail: label(close.index, close.q),
    });
  }

  const gap = biggestGap(full);
  if (gap) list.push({ emoji: "🔍", title: gap.title, detail: gap.detail });

  const scales = full.overall
    .map((q, index) => ({ q, index, avg: q.scale?.avg ?? null }))
    .filter((s): s is { q: QuestionStats; index: number; avg: number } => s.q.type === "scale" && s.avg !== null)
    .sort((a, b) => b.avg - a.avg);
  if (scales.length > 0) {
    // 다른 척도 문항보다 확실히 높을 때만 "가장 높아요" (동점이면 점수만)
    const highest = scales.length > 1 && scales[0].avg > scales[1].avg;
    list.push({ emoji: "⭐", title: `평균 ${scales[0].avg}점${highest ? "으로 가장 높아요" : ""}`, detail: label(scales[0].index, scales[0].q) });
  }
  // 가장 낮은 점수: 가장 높은 점수와 다를 때만 (같으면 "높아요·낮아요"가 같이 나오지 않게)
  const low = scales[scales.length - 1];
  if (scales.length > 1 && low.avg < scales[0].avg) {
    list.push({ emoji: "📉", title: `평균 ${low.avg}점으로 가장 낮아요`, detail: label(low.index, low.q) });
  }

  // 아무 규칙에도 안 걸리면 첫 고르기 문항의 가장 많은 답이라도
  if (list.length === 0 && singles[0]) {
    const s = singles[0];
    list.push({ emoji: "💡", title: `가장 많은 답 ‘${s.first.text}’ ${s.p1}%`, detail: label(s.index, s.q) });
  }

  return list.slice(0, MAX_INSIGHTS);
}

// 평균 응답 시간: 95 → "1분 35초"
export function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}
