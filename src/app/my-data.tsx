// ys-162 내 데이터 · F-701 (2026-11-14 마이 탭 시안 ⑤: 마이 홈 "내 데이터 → 전체 보기"에서. [응답한 | 스크랩 | 열람한])
import { Stack } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";

import MyDataPanel from "@/components/MyDataPanel";
import { colors, spacing } from "@/constants/theme";

export default function MyData() {
  return (
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "내 데이터" }} />
      <MyDataPanel />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
});
