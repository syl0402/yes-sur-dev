// [추천순 ▾] 같은 작은 선택 버튼: 누르면 아래에서 선택 창이 올라온다 (2026-11-02)
// 기본값이 아닌 것을 고르면 버튼이 파랗게 바뀌어 "필터가 걸렸다"는 걸 보여 준다
import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

type Props<T extends string> = {
  // 선택 창 제목 (예: "정렬")
  title: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  // 이 값이면 "아직 안 고름"으로 보고 placeholder를 보여 준다 (예: 소요시간 전체)
  defaultValue?: T;
  placeholder?: string;
};

export default function SelectButton<T extends string>({ title, options, value, onChange, defaultValue, placeholder }: Props<T>) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const isDefault = defaultValue !== undefined && value === defaultValue;
  const label = isDefault && placeholder ? placeholder : (options.find((o) => o.value === value)?.label ?? placeholder ?? title);
  // 정렬처럼 기본값이 없으면 늘 회색, 필터는 걸렸을 때만 파랑
  const active = defaultValue !== undefined && !isDefault;

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={[styles.button, active && styles.buttonOn]} hitSlop={4}>
        <Text style={[styles.label, active && styles.labelOn]}>{label} ▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={styles.handle} />
            <Text style={styles.title}>{title}</Text>
            {options.map((o) => {
              const on = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  style={styles.option}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, on && styles.optionTextOn]}>{o.label}</Text>
                  {on && <Text style={styles.check}>✓</Text>}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  buttonOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  label: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.text,
  },
  labelOn: {
    color: colors.primary,
    fontWeight: "700",
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay,
  },
  sheet: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.subtitle,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  optionText: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  optionTextOn: {
    fontWeight: "800",
    color: colors.primary,
  },
  check: {
    fontSize: fontSize.body,
    fontWeight: "800",
    color: colors.primary,
  },
});
