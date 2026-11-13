// 아래에서 올라오는 연도 목록 창 (입학년도·출생연도). 창 모양은 공용 BottomSheet (2026-11-14)
import { Pressable, ScrollView, StyleSheet } from "react-native";

import BottomSheet from "@/components/ui/BottomSheet";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";

type Props = {
  visible: boolean;
  title: string;
  years: number[];
  selected: number | null;
  onSelect: (year: number) => void;
  onClose: () => void;
};

export default function YearPicker({ visible, title, years, selected, onSelect, onClose }: Props) {
  if (!visible) return null;
  return (
    <BottomSheet onClose={onClose}>
      <Text style={styles.sheetTitle}>{title}</Text>
      <ScrollView style={styles.list}>
        {years.map((year) => (
          <Pressable
            key={year}
            style={styles.yearRow}
            onPress={() => {
              onSelect(year);
              onClose();
            }}
          >
            <Text style={[styles.yearText, selected === year && styles.yearSelected]}>{year}년</Text>
          </Pressable>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetTitle: {
    marginTop: 18,
    marginBottom: spacing.sm,
    fontSize: fontSize.subtitle,
    fontWeight: "800",
    color: colors.text,
  },
  list: {
    maxHeight: 360,
  },
  yearRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  yearText: {
    fontSize: fontSize.body,
    color: colors.text,
    textAlign: "center",
  },
  yearSelected: {
    color: colors.primary,
    fontWeight: "700",
  },
});
