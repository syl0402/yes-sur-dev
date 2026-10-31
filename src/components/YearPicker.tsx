import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

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

// 아래에서 올라오는 연도 목록 창 (입학년도·출생연도)
export default function YearPicker({ visible, title, years, selected, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>{title}</Text>
        <ScrollView>
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  sheet: {
    maxHeight: "50%",
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sheetTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
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
