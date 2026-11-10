// 🎁 보상 안내 상자 (설문 상세 · 응답 완료). 작성자가 쓴 글이라 링크는 확인 후 열린다 (2026-11-07)
import { StyleSheet, View } from "react-native";

import LinkedText from "@/components/LinkedText";
import AppIcon from "@/components/AppIcon";
import { Text } from "@/components/ui/Text";
import { uiIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

export default function RewardNotice({ note, hint }: { note: string; hint?: string }) {
  return (
    <View style={styles.box}>
      <View style={styles.titleRow}>
        <AppIcon name={uiIcons.gift} size={16} color={colors.primary} />
        <Text style={styles.title}>보상 안내</Text>
      </View>
      <LinkedText style={styles.note} selectable>
        {note}
      </LinkedText>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
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
