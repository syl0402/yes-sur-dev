// 글자 탭 (카테고리 등): 옆으로 넘기고, 고른 것만 진한 글자 + 파란 밑줄 (2026-11-02, 당근·쿠팡 방식)
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

export default function TextTabs<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.tab, on && styles.tabOn]} hitSlop={4}>
              <Text style={[styles.text, on && styles.textOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    gap: spacing.md + spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  tab: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    marginBottom: -1,
  },
  tabOn: {
    borderBottomColor: colors.primary,
  },
  text: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.textSubtle,
  },
  textOn: {
    fontWeight: "800",
    color: colors.text,
  },
});
