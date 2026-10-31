// 탭 전환 (예: 진행 중 · 완료 · 마감). 회색 틀 안에서 고른 칸만 흰색 (2026-10-31 디자인)
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, shadow, spacing } from "@/constants/theme";

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

export default function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.wrap}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} style={[styles.item, on && styles.itemOn]} onPress={() => onChange(o.value)}>
            <Text style={[styles.text, on && styles.textOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    padding: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  item: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  itemOn: {
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  text: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.textMuted,
  },
  textOn: {
    color: colors.primary,
    fontWeight: "700",
  },
});
