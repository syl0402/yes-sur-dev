// 비밀번호 입력칸: 오른쪽 눈 버튼으로 보기 ↔ 가리기 (2026-11-02)
// 2026-11-14: 안드로이드에서 빈 칸일 때 안내 글자(placeholder)가 벌어져 보여서, 비어 있으면 가리기를 끈다
import { useState } from "react";
import { Platform, Pressable, StyleSheet, type TextInputProps, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import { TextInput } from "@/components/ui/Text";
import { passwordIcons } from "@/constants/icons";
import { colors, spacing } from "@/constants/theme";

export default function PasswordInput({ style, ...rest }: Omit<TextInputProps, "secureTextEntry">) {
  const [shown, setShown] = useState(false);
  return (
    <View style={styles.wrap}>
      <TextInput
        {...rest}
        style={[style, styles.input]}
        secureTextEntry={!shown && (Platform.OS !== "android" || (rest.value ?? "").length > 0)}
      />
      <Pressable
        onPress={() => setShown(!shown)}
        style={styles.eye}
        hitSlop={10}
        accessibilityLabel={shown ? "비밀번호 가리기" : "비밀번호 보기"}
      >
        <AppIcon name={shown ? passwordIcons.hide : passwordIcons.show} size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: "center",
  },
  // 눈 버튼과 글자가 겹치지 않게
  input: {
    paddingRight: 44,
  },
  eye: {
    position: "absolute",
    right: spacing.md,
  },
});
