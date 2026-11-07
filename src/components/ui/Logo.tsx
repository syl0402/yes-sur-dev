// 제목줄 왼쪽 로고 (2026-11-04 디자인팀 가로형 로고: 심볼 + 옛썰 + Yes Sur)
import { Image } from "expo-image";
import { StyleSheet } from "react-native";

// 원본 비율 1015 × 381
const HEIGHT = 32;

export default function Logo() {
  return (
    <Image
      source={require("../../../assets/images/logo-horizontal.png")}
      style={styles.logo}
      contentFit="contain"
      accessibilityLabel="옛썰 Yes Sur"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    height: HEIGHT,
    width: (HEIGHT * 1015) / 381,
  },
});
