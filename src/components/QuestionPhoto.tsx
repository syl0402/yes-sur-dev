// 설문 문항 사진 (2026-11-22 사진 기능 C). 응답 화면은 크게(large), 결과 화면은 작게(thumb). 누르면 화면 가득 크게
import { Image } from "expo-image";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { contentImageUrl } from "@/lib/contentImage";

export default function QuestionPhoto({ path, size }: { path: string | null | undefined; size: "large" | "thumb" }) {
  const [open, setOpen] = useState(false);
  const url = contentImageUrl(path);
  if (!url) return null;

  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityLabel="문항 사진 크게 보기">
        <Image
          source={{ uri: url }}
          style={size === "large" ? styles.large : styles.thumb}
          contentFit={size === "large" ? "contain" : "cover"}
          transition={150}
        />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="닫기">
          <Image source={{ uri: url }} style={styles.full} contentFit="contain" />
          <View style={styles.close}>
            <Text style={styles.closeText}>닫기</Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // 세로로 긴 사진도 잘리지 않게 칸 안에 맞춘다
  large: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.md,
    backgroundColor: colors.overlayStrong,
  },
  full: {
    width: "100%",
    height: "80%",
  },
  close: {
    alignSelf: "center",
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  closeText: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.text,
  },
});
