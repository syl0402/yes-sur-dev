import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { Bar, percent } from "@/components/results/QuestionResult";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import { GROUP_DIMS, type GroupDim, sortGroups } from "@/lib/hub";

type GroupCount = { label: string; n: number | null; hidden: boolean };

// 응답자 구성: 계열·학년·성별·나이대마다 가로 막대 (가장 많은 그룹 강조). 5명 미만 그룹은 숫자 없이 한 줄로 모은다
// compact: 카드 하나에 기준 칩으로 바꿔 보기 (열람 전 미리보기용). 아니면 기준마다 카드 (결과 '응답자' 탭)
export default function CompositionChart({
  groups,
  compact,
}: {
  groups: Record<GroupDim, GroupCount[]>;
  compact?: boolean;
}) {
  const [dim, setDim] = useState<GroupDim>("major");

  if (compact) {
    return (
      <Card>
        <Text style={styles.title}>응답자 구성</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {GROUP_DIMS.map((d) => (
            <Chip key={d.value} label={d.label} selected={dim === d.value} onPress={() => setDim(d.value)} />
          ))}
        </ScrollView>
        <DimBars groups={groups[dim] ?? []} dim={dim} />
      </Card>
    );
  }

  return (
    <>
      {GROUP_DIMS.map((d) => (
        <Card key={d.value}>
          <Text style={styles.title}>{d.label}</Text>
          <DimBars groups={groups[d.value] ?? []} dim={d.value} />
        </Card>
      ))}
    </>
  );
}

function DimBars({ groups, dim }: { groups: GroupCount[]; dim: GroupDim }) {
  const sorted = sortGroups(dim, groups);
  const shown = sorted.filter((g) => !g.hidden && g.n !== null);
  const hidden = sorted.filter((g) => g.hidden);
  const total = shown.reduce((sum, g) => sum + (g.n ?? 0), 0);
  const max = Math.max(0, ...shown.map((g) => g.n ?? 0));
  return (
    <View style={styles.bars}>
      {shown.map((g) => (
        <Bar key={g.label} label={g.label} count={g.n ?? 0} pct={percent(g.n ?? 0, total)} top={g.n === max} />
      ))}
      {hidden.length > 0 && <Text style={styles.hidden}>5명 미만이라 숨김: {hidden.map((g) => g.label).join(", ")}</Text>}
      {shown.length === 0 && hidden.length === 0 && <Text style={styles.hidden}>정보가 없어요.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  chips: {
    gap: spacing.sm,
  },
  bars: {
    gap: spacing.sm,
  },
  hidden: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
});
