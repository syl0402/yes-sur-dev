// ys-170 의견 보내기 · F-902 (버그·불편·제안 → 운영자 답변을 "내가 보낸 의견"에서 확인)
// 2026-11-14 마이 탭 시안 ⑨: 종류마다 예시 문구가 바뀜 · 화면 캡처 최대 3장 첨부 · 상태 색 (반영 완료 연두 · 답변 완료 파랑 · 확인 중 회색)
import Constants from "expo-constants";
import * as Device from "expo-device";
import { Image } from "expo-image";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import Chips from "@/components/create/Chips";
import { formStyles } from "@/components/create/formStyles";
import LabelRow from "@/components/create/LabelRow";
import PrimaryButton from "@/components/PrimaryButton";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { Text, TextInput } from "@/components/ui/Text";
import { feedbackIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { FEEDBACK_IMAGE_MAX, type PickedImage, pickFeedbackImages, uploadFeedbackImage } from "@/lib/feedbackImage";
import { formatDate } from "@/lib/format";
import { canPickImage } from "@/lib/nativeFeatures";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

type Category = "bug" | "inconvenience" | "idea" | "other";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "bug", label: "버그·오류" },
  { value: "inconvenience", label: "불편해요" },
  { value: "idea", label: "바라는 기능" },
  { value: "other", label: "기타" },
];

// 종류마다 바뀌는 예시 문구
const PLACEHOLDERS: Record<Category, string> = {
  bug: "예: 설문 응답 화면에서 [다음]을 눌러도 안 넘어가요",
  inconvenience: "예: 포인트 내역에서 무슨 포인트인지 모르겠어요",
  idea: "예: 설문에 사진 보기가 있으면 좋겠어요",
  other: "자유롭게 적어 주세요",
};

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: "확인 중", tone: "muted" },
  answered: { label: "답변 완료", tone: "blue" },
  done: { label: "반영 완료", tone: "lime" },
};

const BODY_MAX = 1000;

type MyFeedback = {
  id: number;
  category: Category;
  body: string;
  status: string;
  reply: string | null;
  image_path: string | null;
  image_paths: string[] | null;
  created_at: string;
};

// 버그를 다시 만들어 보는 데 필요한 기기 정보 (개인정보 아님)
function deviceInfo() {
  return {
    os: Platform.OS,
    osVersion: String(Platform.Version),
    model: Device.modelName ?? null,
    appVersion: Constants.expoConfig?.version ?? null,
  };
}

export default function Feedback() {
  // from: 어느 화면에서 들어왔는지 (마이 탭, 내 정보 등)
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [body, setBody] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [mine, setMine] = useState<MyFeedback[]>([]);

  const load = useCallback(() => {
    supabase
      .from("feedback")
      .select("id, category, body, status, reply, image_path, image_paths, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setMine((data as MyFeedback[] | null) ?? []));
  }, []);

  useFocusEffect(load);

  const attach = async () => {
    try {
      const picked = await pickFeedbackImages(FEEDBACK_IMAGE_MAX - images.length);
      if (picked.length > 0) setImages((all) => [...all, ...picked].slice(0, FEEDBACK_IMAGE_MAX));
    } catch {
      showNotice("사진을 고르지 못했어요", "사진 접근을 허용했는지 확인해 주세요.");
    }
  };

  const send = async () => {
    if (!category || !body.trim() || sending) return;
    setSending(true);
    setError("");
    const imagePaths: string[] = [];
    if (images.length > 0) {
      try {
        for (const img of images) imagePaths.push(await uploadFeedbackImage(img));
      } catch {
        setSending(false);
        setError("캡처를 올리지 못했어요. 캡처를 빼고 보내거나 잠시 후 다시 시도해 주세요.");
        return;
      }
    }
    const { error: sendError } = await supabase.rpc("send_feedback", {
      p_category: category,
      p_body: body.trim(),
      p_screen: from ?? undefined,
      p_device: deviceInfo(),
      p_images: imagePaths,
    });
    setSending(false);
    if (sendError) {
      setError(errorMessage(sendError));
      return;
    }
    setCategory(null);
    setBody("");
    setImages([]);
    load();
    showNotice("의견을 보냈어요", "꼼꼼히 읽고 답변할게요. 아래 '내가 보낸 의견'에서 확인할 수 있어요.");
  };

  const buttonTitle = !category ? "종류를 골라 주세요" : !body.trim() ? "내용을 써 주세요" : "보내기";

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "의견 보내기" }} />

      <Text style={styles.lead}>불편한 점, 오류, 바라는 기능을 알려 주세요. 더 나은 옛썰을 만드는 데 큰 힘이 돼요.</Text>

      <View style={styles.field}>
        <Text style={styles.label}>어떤 이야기인가요?</Text>
        <Chips options={CATEGORIES} selected={category} onSelect={setCategory} />
      </View>

      <View style={styles.field}>
        <LabelRow label="내용" length={body.length} max={BODY_MAX} />
        <TextInput
          style={[formStyles.input, formStyles.multiline, styles.body]}
          value={body}
          onChangeText={setBody}
          placeholder={PLACEHOLDERS[category ?? "bug"]}
          maxLength={BODY_MAX}
          multiline
        />
        {/* 화면 캡처 최대 3장 (사진 고르기 부품이 있는 앱에서만) */}
        {canPickImage && (
          <View style={styles.attachRow}>
            {images.map((img, i) => (
              <View key={img.uri} style={styles.thumbWrap}>
                <Image source={{ uri: img.uri }} style={styles.thumb} contentFit="cover" />
                <Pressable
                  onPress={() => setImages((all) => all.filter((_, j) => j !== i))}
                  hitSlop={8}
                  style={styles.thumbRemove}
                  accessibilityLabel="캡처 빼기"
                >
                  <AppIcon name={feedbackIcons.remove} size={14} color={colors.onPrimary} />
                </Pressable>
              </View>
            ))}
            {images.length < FEEDBACK_IMAGE_MAX && (
              <Pressable onPress={attach} style={({ pressed }) => [styles.attach, pressed && styles.pressed]}>
                <AppIcon name={feedbackIcons.image} size={16} color={colors.textStrong} />
                <Text style={styles.attachText}>
                  {images.length === 0 ? "화면 캡처 첨부" : `${images.length}/${FEEDBACK_IMAGE_MAX}`}
                </Text>
              </Pressable>
            )}
          </View>
        )}
        <Text style={formStyles.hint}>오류를 고치려고 기기 종류·앱 버전만 함께 보내요. 이름·연락처는 보내지 않아요.</Text>
      </View>

      {error !== "" && <Text style={formStyles.error}>{error}</Text>}

      <PrimaryButton title={buttonTitle} onPress={send} disabled={!category || !body.trim()} loading={sending} />

      {mine.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.label}>내가 보낸 의견</Text>
          {mine.map((f) => {
            const status = STATUS[f.status] ?? STATUS.pending;
            return (
              <Card key={f.id}>
                <View style={styles.itemHead}>
                  <Text style={styles.meta}>
                    {CATEGORIES.find((c) => c.value === f.category)?.label ?? "기타"} · {formatDate(f.created_at)}
                    {(f.image_paths?.length ?? 0) + (f.image_path ? 1 : 0) > 0
                      ? ` · 캡처 ${(f.image_paths?.length ?? 0) + (f.image_path ? 1 : 0)}장`
                      : ""}
                  </Text>
                  <Badge label={status.label} tone={status.tone} size="sm" />
                </View>
                <Text style={styles.itemBody}>{f.body}</Text>
                {f.reply ? (
                  <View style={styles.reply}>
                    <Text style={styles.replyLabel}>옛썰 답변</Text>
                    <Text style={styles.itemBody}>{f.reply}</Text>
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 20,
    paddingBottom: spacing.xl,
    gap: 20,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.iconStrong,
  },
  body: {
    minHeight: 140,
    backgroundColor: colors.onPrimary,
  },
  attachRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  attach: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 72,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    backgroundColor: colors.onPrimary,
  },
  attachText: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.textStrong,
  },
  pressed: {
    opacity: 0.7,
  },
  thumbWrap: {
    width: 72,
    height: 72,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text,
  },
  section: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  itemHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  meta: {
    flexShrink: 1,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  itemBody: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  reply: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primaryFaint,
    gap: 4,
  },
  replyLabel: {
    fontSize: fontSize.caption,
    fontWeight: "700",
    color: colors.primaryStrong,
  },
});
