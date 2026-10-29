import { StyleSheet, Text, View } from "react-native";

import { colors, fontSize, spacing } from "@/constants/theme";

type Props = {
  title: string;
  message: string;
};

// 아직 만들지 않은 탭·화면에 보여주는 "준비 중" 안내
export default function ComingSoon({ title, message }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
  },
  message: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: "center",
  },
});
