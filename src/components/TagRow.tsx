// 카드 안 태그 한 줄 "#연애 #MBTI" (2026-11-07, 2026-11-09 피그마: 회색 작은 글씨). 태그를 누르면 onPress로 그 태그를 넘긴다 (같은 탭에서 걸러 보기)
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import { formatTag, type Tag } from "@/lib/tags";

export default function TagRow({ tags, onPress }: { tags: Tag[]; onPress: (tag: Tag) => void }) {
  if (tags.length === 0) return null;
  return (
    <View style={styles.row}>
      {tags.map((t) => (
        <Pressable key={t.id} onPress={() => onPress(t)} hitSlop={6}>
          <Text style={styles.tag}>{formatTag(t.name)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  // 2026-11-09 피그마: 작은 글씨 (2026-11-10 피그마: 회색 → 파랑)
  tag: {
    fontSize: fontSize.caption,
    lineHeight: 20,
    fontWeight: "500",
    color: colors.primary,
  },
});
