// ys-001 회원가입 · F-103 회원정보 입력
import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { colors, fontSize, spacing } from "@/constants/theme";

// TODO(임시): 자리만 잡아 둔 화면 · 가입 3차에서 비밀번호·회원정보 입력으로 교체 · docs/PROGRESS.md
export default function SignupProfile() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "회원가입" }} />
      <Text style={styles.text}>인증 완료! 회원정보 입력 화면은 다음 단계에서 만들어요.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  text: {
    fontSize: fontSize.body,
    color: colors.text,
    textAlign: "center",
  },
});
