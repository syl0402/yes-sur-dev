// 묶음 제목 + 설명 + 오른쪽 › (2026-10-31 디자인, 2026-11-10 피그마 145:2973 값: 제목 18 Blue 900 · 설명 12 · 오른쪽 › 아이콘)
import { Pressable, StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import { Text } from "@/components/ui/Text";
import { uiIcons } from "@/constants/icons";
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
        <Pressable onPress={onAction} hitSlop={10} accessibilityLabel={actionLabel}>
          <AppIcon name={uiIcons.chevron} size={24} color={colors.iconStrong} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  main: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.subtitle,
    lineHeight: 24,
    fontWeight: "700",
    color: colors.heading,
  },
  subtitle: {
    fontSize: fontSize.caption,
    lineHeight: 16,
    color: colors.textSubtle,
  },
});
