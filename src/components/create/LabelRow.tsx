// 칸 이름표 + (거의 다 찼을 때만) 오른쪽 글자 수 (2026-11-12: 칸마다 글자 수 줄이 있으면 어수선해서)
// 설문 등록 기본 정보 · 커뮤니티 글 만들기가 같이 쓴다 (2026-11-14 공용으로 뺌)
import { StyleSheet, View } from "react-native";

import { formStyles } from "@/components/create/formStyles";
import { Text } from "@/components/ui/Text";
import { colors, fontSize } from "@/constants/theme";

export default function LabelRow({ label, optional, length, max }: { label: string; optional?: boolean; length: number; max: number }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>
        {label}
        {optional && <Text style={styles.labelLight}> (선택)</Text>}
      </Text>
      {length >= max * 0.8 && (
        <Text style={formStyles.hint}>
          {length} / {max}자
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.iconStrong,
  },
  labelLight: {
    fontWeight: "500",
  },
});
