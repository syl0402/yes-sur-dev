// 도넛 고리만 그리는 부품 (react-native-svg). CompositionChart가 필요할 때만 불러온다 (lazy)
// → 그림 기능이 없는 옛 APK(1.0.0)에서는 이 파일 자체를 불러오지 않아서 멈추지 않는다 (2026-11-10)
import { StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";

type Segment = { key: string; n: number; color: string };

export default function DonutRing({ segments, total, size, stroke }: { segments: Segment[]; total: number; size: number; stroke: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // 칸 사이 2px 흰 틈 (한 칸뿐이면 틈 없음)
  const gap = segments.filter((x) => x.n > 0).length > 1 ? 2 : 0;
  // 조각마다 시작 위치를 미리 계산 (앞 조각들 길이의 합)
  const lens = segments.map((x) => (total > 0 ? (x.n / total) * c : 0));
  const starts = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    // 12시 방향부터 그리려고 -90도 돌린다 (원에 회전 속성을 주면 웹에서 경고)
    <Svg width={size} height={size} style={styles.rotate}>
      {segments.map((x, i) =>
        x.n === 0 || total === 0 ? null : (
          <Circle
            key={x.key}
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={x.color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${Math.max(0, lens[i] - gap)} ${c}`}
            strokeDashoffset={-starts[i]}
          />
        ),
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  rotate: {
    transform: [{ rotate: "-90deg" }],
  },
});
