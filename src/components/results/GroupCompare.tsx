// 묶음별 비교 막대 (데이터 허브 나눠 보기 · 커뮤니티 글 "그룹별로 보기"가 같이 쓴다, 2026-11-14 공용으로 뺌)
// - DimChips: 나눠 볼 기준 칩 한 줄 (고르면 진한 남색)
// - FocusChips: 볼 답 고르기 칩 (고르면 파랑)
// - GroupCompare: "'답'을 고른 비율"을 묶음별 가로 막대로, 큰 순서. 가장 높은 묶음 진한 파랑·굵게,
//   가장 낮은 묶음 Blue 300, 나머지 Blue 200. 아래 점선 + 전체 값. 응답이 적은 묶음은 흐리게 + 주의 문구
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import GrowBar from "@/components/ui/GrowBar";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius } from "@/constants/theme";

export function DimChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dimRow}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.dimChip, on && styles.dimChipOn]} hitSlop={4}>
              <Text style={[styles.dimText, on && styles.dimTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function FocusChips<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.focusRow}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={[styles.focusChip, on && styles.focusChipOn]} hitSlop={4}>
            <Text style={[styles.focusText, on && styles.focusTextOn]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type CompareRow = { label: string; n: number; value: number };

type Props = {
  // 막대 위 한 줄 (예: ‘도서관’이라고 답한 비율)
  title: ReactNode;
  // 큰 순서로 정렬해서 보여 준다
  rows: CompareRow[];
  // 이 인원 미만 묶음은 흐리게 (point_rules low_response_warning)
  fewUnder: number;
  // 점선 아래 전체 값 (없으면 점선도 없음)
  overall: number | null;
  overallLabel?: string;
  unit?: string;
  // 막대 끝 값 (비율이면 100, 5점 척도면 5)
  max?: number;
};

export default function GroupCompare({ title, rows, fewUnder, overall, overallLabel = "전체 평균", unit = "%", max = 100 }: Props) {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const solid = sorted.filter((r) => r.n >= fewUnder);
  const maxV = solid.length > 0 ? solid[0].value : null;
  const minV = solid.length > 1 ? solid[solid.length - 1].value : null;
  const hasFew = sorted.some((r) => r.n < fewUnder);

  return (
    <View style={styles.compare}>
      <Text style={styles.compareTitle}>{title}</Text>
      {sorted.map((r) => {
        const few = r.n < fewUnder;
        const hi = !few && r.value === maxV;
        const lo = !few && !hi && r.value === minV;
        return (
          <View key={r.label} style={styles.compareRow}>
            <View style={styles.compareName}>
              <Text style={[styles.compareLabel, few && styles.fewText]} numberOfLines={1}>
                {r.label}
              </Text>
              <Text style={styles.groupN}>{r.n}명</Text>
            </View>
            <View style={styles.compareTrack}>
              <GrowBar
                pct={(r.value / max) * 100}
                style={[styles.compareFill, few ? styles.fillFew : hi ? styles.fillHi : lo ? styles.fillLo : styles.fillMid]}
              />
            </View>
            <Text style={[styles.compareValue, hi && styles.compareValueHi, few && styles.fewText]}>
              {r.value}
              {unit}
            </Text>
          </View>
        );
      })}
      {overall !== null && (
        <>
          <DashedLine />
          <View style={styles.average}>
            <Text style={styles.averageLabel}>{overallLabel}</Text>
            <Text style={styles.averageValue}>
              {overall}
              {unit}
            </Text>
          </View>
        </>
      )}
      {hasFew && <Text style={styles.fewNote}>{fewUnder}명 미만 묶음은 흐리게 표시했어요. 해석에 주의해 주세요.</Text>}
    </View>
  );
}

// 가로 점선 한 줄 (한 면만 점선 테두리는 아이폰에서 안 그려져서, 높이 1 상자 안에 점선 상자를 넣고 잘라 낸다)
function DashedLine() {
  return (
    <View style={styles.dashClip}>
      <View style={styles.dash} />
    </View>
  );
}

const styles = StyleSheet.create({
  dimRow: {
    gap: 6,
  },
  dimChip: {
    height: 30,
    justifyContent: "center",
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  dimChipOn: {
    borderColor: colors.text,
    backgroundColor: colors.text,
  },
  dimText: {
    fontSize: fontSize.caption,
    fontWeight: "700",
    color: colors.textStrong,
  },
  dimTextOn: {
    color: colors.onPrimary,
  },
  focusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  focusChip: {
    height: 28,
    justifyContent: "center",
    paddingHorizontal: 9,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  focusChipOn: {
    backgroundColor: colors.primary,
  },
  focusText: {
    maxWidth: 180,
    fontSize: fontSize.caption,
    fontWeight: "700",
    color: colors.textStrong,
  },
  focusTextOn: {
    color: colors.onPrimary,
  },
  compare: {
    gap: 12,
  },
  compareTitle: {
    fontSize: fontSize.small,
    color: colors.textStrong,
  },
  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  compareName: {
    width: 64,
  },
  compareLabel: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.text,
  },
  groupN: {
    fontSize: 11,
    fontWeight: "400",
    color: colors.textMuted,
  },
  compareTrack: {
    flex: 1,
    height: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  compareFill: {
    height: "100%",
    borderRadius: radius.pill,
  },
  fillHi: {
    backgroundColor: colors.primary,
  },
  fillLo: {
    backgroundColor: colors.primaryMuted,
  },
  fillMid: {
    backgroundColor: colors.primaryLight,
  },
  fillFew: {
    backgroundColor: colors.primarySoft,
  },
  compareValue: {
    width: 48,
    textAlign: "right",
    fontSize: fontSize.label,
    fontWeight: "500",
    color: colors.text,
  },
  compareValueHi: {
    fontWeight: "800",
  },
  fewText: {
    color: colors.textSubtle,
  },
  dashClip: {
    height: 1,
    overflow: "hidden",
  },
  dash: {
    height: 2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: "dashed",
    borderRadius: 1,
  },
  average: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -4,
  },
  averageLabel: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  averageValue: {
    fontSize: fontSize.caption,
    fontWeight: "700",
    color: colors.text,
  },
  fewNote: {
    fontSize: fontSize.caption,
    color: colors.warning,
  },
});
