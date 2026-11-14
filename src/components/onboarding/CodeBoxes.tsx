// 인증번호 칸 (2026-11-14 온보딩 시안 ⑤): 숫자 한 칸씩 보이는 상자 줄
// 실제 입력은 보이지 않는 입력칸 하나가 받는다 → 붙여넣기·자동 채우기(메일 앱 코드)도 그대로 된다. 다음 칸으로 저절로 넘어감
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text, TextInput, type TextInputRef } from "@/components/ui/Text";
import { colors, radius } from "@/constants/theme";

type Props = {
  value: string;
  onChange: (v: string) => void;
  length: number;
};

export default function CodeBoxes({ value, onChange, length }: Props) {
  const input = useRef<TextInputRef>(null);
  const [focused, setFocused] = useState(true);
  // 지금 입력할 칸 (다 채웠으면 마지막 칸)
  const current = Math.min(value.length, length - 1);

  return (
    <Pressable onPress={() => input.current?.focus()} accessibilityLabel={`인증번호 ${length}자리`}>
      <View style={styles.row}>
        {Array.from({ length }, (_, i) => (
          <View key={i} style={[styles.box, focused && i === current && styles.boxOn, i < value.length && styles.boxFilled]}>
            <Text style={styles.digit}>{value[i] ?? ""}</Text>
          </View>
        ))}
      </View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9]/g, "").slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        autoFocus
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        caretHidden
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  box: {
    flex: 1,
    maxWidth: 48,
    height: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.onPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  boxFilled: {
    borderColor: colors.borderStrong,
  },
  digit: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },
  // 보이지 않는 입력칸 (상자 위를 덮어서 누르면 키보드가 뜬다)
  hidden: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    backgroundColor: "transparent",
  },
});
