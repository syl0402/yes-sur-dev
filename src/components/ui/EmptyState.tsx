// 빈 목록·완료 안내 (가운데 그림 + 제목 + 설명). 2026-10-31 디자인
// TODO(임시): 그림 자리에 이모지 · 디자인팀 마스코트(옛썰이) PNG를 받으면 image로 교체 · docs/PROGRESS.md
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";

type Props = {
  title: string;
  message?: string;
  emoji?: string;
};

export default function EmptyState({ title, message, emoji = "💬" }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emoji: {
    fontSize: 40,
  },
  title: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  message: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    textAlign: "center",
  },
});
