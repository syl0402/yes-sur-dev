// 제목줄 왼쪽 로고 (2026-10-31 디자인: 옛썰 파랑 + Yes Sur)
// TODO(임시): 글자로 만든 로고 · 디자인팀 로고 PNG(배경 없음)를 받으면 image로 교체 · docs/PROGRESS.md
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors } from "@/constants/theme";

export default function Logo() {
  return (
    <View style={styles.row}>
      <Text style={styles.ko}>옛썰</Text>
      <Text style={styles.en}>
        Yes <Text style={styles.sur}>Sur</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ko: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.primary,
  },
  en: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  // 라임은 흰 바탕 글자로 흐려서 진한 연두로
  sur: {
    color: colors.onAccentSoft,
  },
});
