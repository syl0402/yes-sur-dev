import { Pressable, Text, View } from "react-native";

import { formStyles } from "@/components/create/formStyles";

type Option<T> = { value: T; label: string; disabled?: boolean };

// 여러 줄로 감기는 선택 칩 (하나만 고름)
export default function Chips<T extends string | number>({
  options,
  selected,
  onSelect,
}: {
  options: Option<T>[];
  selected: T | null;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={formStyles.chips}>
      {options.map((o) => {
        const on = selected === o.value;
        return (
          <Pressable
            key={String(o.value)}
            style={[formStyles.chip, on && formStyles.chipSelected, o.disabled && formStyles.chipDisabled]}
            onPress={() => onSelect(o.value)}
            disabled={o.disabled}
          >
            <Text style={[formStyles.chipText, on && formStyles.chipTextSelected]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
