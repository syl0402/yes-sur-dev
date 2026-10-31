// 묶음 제목 + 설명 + 오른쪽 "전체 보기 ›" (2026-10-31 디자인)
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";

type Props = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function SectionHeader({ title, subtitle, actionLabel, onAction }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.main}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.action}>{actionLabel} ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  main: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: fontSize.subtitle,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  action: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.textMuted,
  },
});
