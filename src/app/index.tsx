import { Link } from "expo-router";
import { Text, View, StyleSheet } from "react-native";

export default function Index() {
  return (
    <View style={styles.container}>
      {/* TODO(임시): 개발용 첫 화면 · 진짜 홈·로그인 화면을 만들면 교체 · docs/PROGRESS.md */}
      <Text>Edit src/app/index.tsx to edit this screen.</Text>
      <Link href="/signup/terms">회원가입</Link>
      <Link href="/otp-test">OTP 테스트 화면 열기</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
});
