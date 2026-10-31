import { router } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";

// 화면 맨 아래 작은 "이 설문 신고하기" (설문 상세·데이터 결과). 본인 설문에는 쓰지 않는다
export default function ReportLink({ surveyId }: { surveyId: number }) {
  return (
    <Pressable
      style={styles.link}
      hitSlop={8}
      onPress={() => router.push({ pathname: "/report", params: { survey: String(surveyId) } })}
    >
      <Text style={styles.text}>이 설문 신고하기</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    alignSelf: "center",
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  text: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    textDecorationLine: "underline",
  },
});
