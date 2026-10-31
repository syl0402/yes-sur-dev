import { View } from "react-native";

import { formStyles } from "@/components/create/formStyles";
import Chip from "@/components/ui/Chip";

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
      {options.map((o) => (
        <Chip
          key={String(o.value)}
          label={o.label}
          selected={selected === o.value}
          onPress={() => onSelect(o.value)}
          disabled={o.disabled}
        />
      ))}
    </View>
  );
}
