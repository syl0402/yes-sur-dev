// 응답자 구성 (누가 답했나): 카드 하나 + 총 응답자 · 한 줄 요약 + [성별 | 나이대 | 계열 | 학년] 글자 탭 (2026-11-10 정리)
// variant "bar"  (A안): 칸이 적으면 두꺼운 나눔 막대 + 목록
// variant "donut"(B안): 칸이 적으면 도넛 + 오른쪽 목록 (react-native-svg)
// 계열처럼 칸이 많으면 두 안 모두 많은 순서 가로 막대 (도넛·나눔 막대는 칸이 많으면 읽기 어려움)
// 색: 진한 파랑 → 옅은 파랑 4단계, 미입력은 회색 (이웃한 색끼리 색맹도 구분되는지 검사함)
// 5명 미만 그룹은 숫자 없이 한 줄로 모은다
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Bar, percent } from "@/components/results/QuestionResult";
import Card from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import TextTabs from "@/components/ui/TextTabs";
import { chartRamp, chartUnknown, colors, fontSize, radius, spacing } from "@/constants/theme";
import { type GroupDim, sortGroups } from "@/lib/hub";

type GroupCount = { label: string; n: number | null; hidden: boolean };
type Variant = "bar" | "donut";

// 탭 순서: 인적 정보(성별·나이대) → 학교 정보(학년·계열). 칸이 많은 계열(막대)은 맨 뒤
const DIMS: { value: GroupDim; label: string }[] = [
  { value: "gender", label: "성별" },
  { value: "age", label: "나이대" },
  { value: "grade", label: "학년" },
  { value: "major", label: "계열" },
];
// 나눔 막대·도넛으로 그릴 수 있는 칸 수 (파랑 4단계 + 미입력)
const MAX_SEGMENTS = 5;

// compact: 열람 전 미리보기 ("응답자 구성")
export default function CompositionChart({
  groups,
  compact,
  variant = "bar",
}: {
  groups: Record<GroupDim, GroupCount[]>;
  compact?: boolean;
  variant?: Variant;
}) {
  const [dim, setDim] = useState<GroupDim>("gender");
  const list = sortGroups(dim, groups[dim] ?? []);
  const shown = list.filter((g) => !g.hidden && g.n !== null);
  const hidden = list.filter((g) => g.hidden);
  const total = shown.reduce((sum, g) => sum + (g.n ?? 0), 0);
  // 총 응답자: 어느 기준이든 합은 같으므로 성별 합 (숨긴 묶음은 숫자가 없어 빠질 수 있음)
  const allCount = (groups.gender ?? []).reduce((sum, g) => sum + (g.n ?? 0), 0);
  const summary = summarize(groups);
  // 막대로 그릴지 (칸이 많으면) · 도넛이 보이는지 (도넛이면 가운데에 총 인원이 있어서 제목 옆 숫자는 뺀다)
  const ranked = dim === "major" || shown.length > MAX_SEGMENTS;
  const donutShown = variant === "donut" && !ranked && shown.length > 0;

  return (
    <Card>
      <View style={styles.head}>
        <Text style={styles.title}>{compact ? "응답자 구성" : "누가 답했나"}</Text>
        {allCount > 0 && !donutShown && <Text style={styles.total}>{allCount}명</Text>}
      </View>
      {summary && <Text style={styles.summary}>{summary}</Text>}
      <TextTabs options={DIMS} value={dim} onChange={setDim} fill />
      {shown.length === 0 ? (
        <Text style={styles.hidden}>{hidden.length > 0 ? "모든 묶음이 5명 미만이라 숨겼어요." : "정보가 없어요."}</Text>
      ) : ranked ? (
        <RankedBars groups={shown} total={total} />
      ) : variant === "donut" ? (
        <Donut rows={toRows(shown, total)} total={total} />
      ) : (
        <ShareBar rows={toRows(shown, total)} />
      )}
      {hidden.length > 0 && shown.length > 0 && (
        <Text style={styles.hidden}>5명 미만이라 숨김: {hidden.map((g) => g.label).join(", ")}</Text>
      )}
    </Card>
  );
}

// 미입력·선택 안 함
function isUnknown(label: string) {
  return label.includes("미입력") || label.includes("선택 안 함");
}

// 한 줄 요약: 기준마다 1위 (공동 1위면 "사회/공학/의약 계열"처럼 모두). 미입력·숨긴 묶음 제외
function summarize(groups: Record<GroupDim, GroupCount[]>): string | null {
  const tops = DIMS.map(({ value }) => {
    const list = (groups[value] ?? []).filter((g) => !g.hidden && g.n !== null && !isUnknown(g.label));
    const max = Math.max(0, ...list.map((g) => g.n ?? 0));
    if (max === 0) return null;
    const names = list.filter((g) => g.n === max).map((g) => g.label).join("/");
    return value === "major" ? `${names} 계열` : names;
  }).filter((t): t is string => t !== null);
  return tops.length > 0 ? `가장 많은 응답자: ${tops.join(" · ")}` : null;
}

type Row = { label: string; n: number; pct: number; color: string; onDark: boolean };

// 묶음 → 색이 정해진 줄 (진한 파랑부터 순서대로, 미입력은 회색)
function toRows(groups: GroupCount[], total: number): Row[] {
  let step = 0;
  return groups.map((g) => {
    const n = g.n ?? 0;
    const unknown = isUnknown(g.label);
    const shade = unknown ? null : step++;
    return {
      // "선택 안 함·미입력"은 목록에서 잘리지 않게 짧게
      label: unknown ? "미입력" : g.label,
      n,
      pct: percent(n, total),
      color: shade === null ? chartUnknown : chartRamp[Math.min(shade, chartRamp.length - 1)],
      // 진한 두 단계·회색 위에는 흰 글자, 옅은 파랑 위에는 남색 글자
      onDark: shade === null || shade < 2,
    };
  });
}

// 이름 · % · 명 목록 (색 네모)
function Legend({ rows }: { rows: Row[] }) {
  return (
    <View style={styles.legend}>
      {rows.map((r) => (
        <View key={r.label} style={styles.legendRow}>
          <View style={[styles.swatch, { backgroundColor: r.color }]} />
          <Text style={styles.legendLabel} numberOfLines={1}>
            {r.label}
          </Text>
          <Text style={styles.legendPct}>
            {r.pct}%<Text style={styles.legendN}>  {r.n}명</Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

// A안: 두꺼운 나눔 막대 + 목록
function ShareBar({ rows }: { rows: Row[] }) {
  return (
    <View style={styles.share}>
      <View style={styles.tallBar}>
        {rows.map((r) =>
          r.n === 0 ? null : (
            <View key={r.label} style={[styles.segment, { flex: r.n, backgroundColor: r.color }]}>
              {r.pct >= 12 && <Text style={[styles.segmentText, !r.onDark && styles.segmentTextDark]}>{r.pct}%</Text>}
            </View>
          ),
        )}
      </View>
      <Legend rows={rows} />
    </View>
  );
}

// B안: 도넛 (가운데 총 인원) + 오른쪽 목록. 칸 사이 2px 흰 틈
const SIZE = 132;
const STROKE = 22;
function Donut({ rows, total }: { rows: Row[]; total: number }) {
  const r = (SIZE - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const gap = rows.filter((x) => x.n > 0).length > 1 ? 2 : 0;
  // 조각마다 시작 위치를 미리 계산 (앞 조각들 길이의 합)
  const lens = rows.map((x) => (total > 0 ? (x.n / total) * c : 0));
  const starts = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <View style={styles.donutWrap}>
      <View style={styles.donut}>
        {/* 12시 방향부터 그리려고 상자를 -90도 돌린다 (원에 회전 속성을 주면 웹에서 경고) */}
        <Svg width={SIZE} height={SIZE} style={styles.rotate}>
          {rows.map((x, i) =>
            x.n === 0 || total === 0 ? null : (
              <Circle
                key={x.label}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={r}
                stroke={x.color}
                strokeWidth={STROKE}
                fill="none"
                strokeDasharray={`${Math.max(0, lens[i] - gap)} ${c}`}
                strokeDashoffset={-starts[i]}
              />
            ),
          )}
        </Svg>
        <View style={styles.donutCenter} pointerEvents="none">
          <Text style={styles.donutLabel}>응답</Text>
          <Text style={styles.donutValue}>{total}명</Text>
        </View>
      </View>
      <View style={styles.donutLegend}>
        <Legend rows={rows} />
      </View>
    </View>
  );
}

// 많은 순서대로 가로 막대 (가장 많은 것만 파랑)
function RankedBars({ groups, total }: { groups: GroupCount[]; total: number }) {
  const ranked = [...groups].sort((a, b) => (b.n ?? 0) - (a.n ?? 0));
  const max = ranked[0]?.n ?? 0;
  return (
    <View style={styles.bars}>
      {ranked.map((g) => (
        <Bar key={g.label} label={g.label} count={g.n ?? 0} pct={percent(g.n ?? 0, total)} top={max > 0 && g.n === max} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  title: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  total: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textMuted,
  },
  summary: {
    marginTop: -4,
    fontSize: fontSize.small,
    color: colors.textMuted,
    lineHeight: 19,
  },
  hidden: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  bars: {
    gap: 14,
    marginTop: spacing.xs,
  },
  share: {
    gap: 16,
    marginTop: spacing.xs,
  },
  // 칸 사이 2px 흰 틈
  tallBar: {
    flexDirection: "row",
    height: 40,
    gap: 2,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  segment: {
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  segmentTextDark: {
    color: colors.text,
  },
  legend: {
    gap: 10,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  legendPct: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  legendN: {
    fontSize: fontSize.caption,
    fontWeight: "400",
    color: colors.textSubtle,
  },
  donutWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginTop: spacing.xs,
  },
  donut: {
    width: SIZE,
    height: SIZE,
  },
  rotate: {
    transform: [{ rotate: "-90deg" }],
  },
  donutCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  donutLabel: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  donutValue: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  donutLegend: {
    flex: 1,
  },
});
