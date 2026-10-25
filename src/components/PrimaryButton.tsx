import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { colors, fontSize, spacing } from "@/constants/theme";

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  // true면 돌아가는 표시를 보여주고 누르기를 막는다 (연타 방지)
  loading?: boolean;
};

export default function PrimaryButton({ title, onPress, disabled, loading }: Props) {
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={[styles.button, inactive && styles.inactive]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <Text style={styles.title}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  inactive: {
    backgroundColor: colors.disabled,
  },
  title: {
    color: colors.onPrimary,
    fontSize: fontSize.body,
    fontWeight: "600",
  },
});
