// [추천순 ▾] 같은 작은 선택 버튼: 누르면 아래에서 선택 창이 올라온다 (2026-11-02)
// 선택 창 모양은 공용 BottomSheet (2026-11-14)
// 기본값이 아닌 것을 고르면 버튼이 파랗게 바뀌어 "필터가 걸렸다"는 걸 보여 준다
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import AppIcon from "@/components/AppIcon";
import BottomSheet from "@/components/ui/BottomSheet";
import { Text } from "@/components/ui/Text";
import { uiIcons } from "@/constants/icons";
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
  const isDefault = defaultValue !== undefined && value === defaultValue;
  const label = isDefault && placeholder ? placeholder : (options.find((o) => o.value === value)?.label ?? placeholder ?? title);
  // 정렬처럼 기본값이 없으면 늘 회색, 필터는 걸렸을 때만 파랑
  const active = defaultValue !== undefined && !isDefault;

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={[styles.button, active && styles.buttonOn]} hitSlop={4}>
        <Text style={[styles.label, active && styles.labelOn]}>{label}</Text>
        <AppIcon name={uiIcons.caretDown} size={14} color={active ? colors.primary : colors.iconStrong} />
      </Pressable>

      {open && (
        <BottomSheet onClose={() => setOpen(false)}>
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
                {on && <AppIcon name={uiIcons.check} size={18} color={colors.primary} />}
              </Pressable>
            );
          })}
        </BottomSheet>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // 2026-11-10 피그마 140:856 값
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  buttonOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  label: {
    fontSize: fontSize.caption,
    fontWeight: "500",
    color: colors.textStrong,
  },
  labelOn: {
    color: colors.primary,
    fontWeight: "700",
  },
  title: {
    marginTop: 18,
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
});
