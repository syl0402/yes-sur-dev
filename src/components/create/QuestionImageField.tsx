// 설문 작성: 문항 사진 1장 붙이기 (2026-11-22 사진 기능 C)
// 고르는 즉시 내 폴더 surveys/<내 id>/ 에 올리고 경로만 임시저장에 남긴다 (폰 안 사진 주소는 나중에 사라질 수 있어서)
// ✕는 문항에서만 뺀다. 복제한 문항이 같은 사진을 쓸 수 있어서 파일은 지우지 않는다
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import QuestionPhoto from "@/components/QuestionPhoto";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { pickContentImage, uploadContentImage } from "@/lib/contentImage";
import { errorMessage } from "@/lib/errors";
import { canPickImage } from "@/lib/nativeFeatures";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

type Props = {
  image: string | undefined;
  onChange: (image: string | undefined) => void;
};

export default function QuestionImageField({ image, onChange }: Props) {
  const [uploading, setUploading] = useState(false);

  // 사진 부품이 없는 옛 앱에서는 칸을 숨긴다
  if (!canPickImage) return null;

  const pick = async () => {
    const picked = await pickContentImage(false);
    if (!picked) return;
    setUploading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) throw new Error("not_authenticated");
      onChange(await uploadContentImage(`surveys/${uid}`, picked));
    } catch (e) {
      showNotice("사진을 올리지 못했어요", errorMessage(e as Error));
    } finally {
      setUploading(false);
    }
  };

  if (uploading) {
    return (
      <View style={styles.add}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.addText}>사진 올리는 중…</Text>
      </View>
    );
  }

  if (!image) {
    return (
      <Pressable style={styles.add} onPress={pick} hitSlop={4} accessibilityLabel="문항 사진 추가">
        <Text style={styles.addText}>+ 사진 추가 (선택)</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.preview}>
      <QuestionPhoto path={image} size="large" />
      <View style={styles.actions}>
        <Pressable onPress={pick} hitSlop={8}>
          <Text style={styles.actionText}>사진 바꾸기</Text>
        </Pressable>
        <Pressable onPress={() => onChange(undefined)} hitSlop={8}>
          <Text style={[styles.actionText, styles.remove]}>사진 빼기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  add: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  addText: {
    fontSize: fontSize.small,
    color: colors.textStrong,
  },
  preview: {
    gap: spacing.xs,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.md,
  },
  actionText: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.primary,
  },
  remove: {
    color: colors.danger,
  },
});
