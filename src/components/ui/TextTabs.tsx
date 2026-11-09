// 글자 탭 (카테고리 등): 옆으로 넘기고, 고른 것만 진한 글자 + 파란 밑줄 (2026-11-02, 당근·쿠팡 방식)
// fill: 탭이 몇 개 안 될 때 가로를 똑같이 나눠 채운다 (커뮤니티 [전체·투표·월드컵·설문 홍보], 2026-11-10)
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  fill?: boolean;
};

export default function TextTabs<T extends string>({ options, value, onChange, fill }: Props<T>) {
  const tabs = options.map((o) => {
    const on = o.value === value;
    return (
      <Pressable
        key={o.value}
        onPress={() => onChange(o.value)}
        style={[styles.tab, fill && styles.tabFill, on && styles.tabOn]}
        hitSlop={4}
      >
        <Text style={[styles.text, on && styles.textOn]}>{o.label}</Text>
      </Pressable>
    );
  });

  return (
    <View style={styles.wrap}>
      {fill ? (
        <View style={styles.fillRow}>{tabs}</View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {tabs}
        </ScrollView>
      )}
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
  fillRow: {
    flexDirection: "row",
  },
  tab: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    marginBottom: -1,
  },
  tabFill: {
    flex: 1,
    alignItems: "center",
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
