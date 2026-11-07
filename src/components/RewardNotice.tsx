// 🎁 보상 안내 상자 (설문 상세 · 응답 완료). 작성자가 쓴 글이라 링크는 확인 후 열린다 (2026-11-07)
import { StyleSheet, View } from "react-native";

import LinkedText from "@/components/LinkedText";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

export default function RewardNotice({ note, hint }: { note: string; hint?: string }) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>🎁 보상 안내</Text>
      <LinkedText style={styles.note} selectable>
        {note}
      </LinkedText>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
  },
  title: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.onAccentSoft,
  },
  note: {
    fontSize: fontSize.body,
    lineHeight: 22,
    color: colors.text,
  },
  hint: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
});
