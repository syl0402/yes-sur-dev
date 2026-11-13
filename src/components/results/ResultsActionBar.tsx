// 결과 화면 아래 고정 바 (2026-11-07 피드백: 가장 중요한 기능이라 어느 탭에서든 바로)
// 2026-11-14 데이터 허브 시안: [출처] [공유] 아이콘 버튼 + [집계 CSV 받기]. 공유 → 결과 카드 공유 시트
import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import ShareSheet from "@/components/results/ShareSheet";
import BottomBar from "@/components/ui/BottomBar";
import Button from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { uiIcons } from "@/constants/icons";
import { colors, fontSize, radius } from "@/constants/theme";
import { copyCitation } from "@/lib/citation";
import { aggregateCsv, exportCsv } from "@/lib/csv";
import type { FullResults } from "@/lib/hub";

type Props = {
  full: FullResults;
  // 출처에 들어갈 설문 이름·주최
  title: string;
  host: string;
};

export default function ResultsActionBar({ full, title, host }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  if (full.total === 0) return null;

  // 집계 CSV (화면에 보이는 것과 같은 내용, 5명 미만 그룹은 숨김)
  const downloadCsv = () => exportCsv(title, "집계", aggregateCsv(full));

  return (
    <>
      <BottomBar>
        <IconButton icon={uiIcons.cite} label="출처" onPress={() => copyCitation(full, title, host)} />
        {/* 결과 카드 이미지는 앱에서만 (웹 미리보기는 이미지로 찍지 못함) */}
        {Platform.OS !== "web" && <IconButton icon={uiIcons.share} label="공유" onPress={() => setSheetOpen(true)} />}
        <Button title="집계 CSV 받기" onPress={downloadCsv} style={styles.main} />
      </BottomBar>
      {sheetOpen && <ShareSheet full={full} title={title} host={host} onClose={() => setSheetOpen(false)} />}
    </>
  );
}

// 아이콘 + 작은 글자 버튼 (52 × 52)
function IconButton({ icon, label, onPress }: { icon: (typeof uiIcons)[keyof typeof uiIcons]; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.iconInner}>
        <AppIcon name={icon} size={20} color={colors.textStrong} />
        <Text style={styles.iconLabel}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
  },
  iconButton: {
    width: 56,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  iconInner: {
    alignItems: "center",
    gap: 2,
  },
  iconLabel: {
    fontSize: fontSize.caption,
    fontWeight: "600",
    color: colors.textStrong,
  },
  pressed: {
    opacity: 0.7,
  },
});
