// ys-183 월드컵 사진 · F-704 (운영자만. 월드컵 후보마다 사진 올리기, 2026-11-16 사진 기능 1단계)
// 사진이 없는 후보는 월드컵 화면에서 지금처럼 글자로만 보인다
import { Image } from "expo-image";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import EmptyState from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { showConfirm } from "@/lib/confirm";
import { contentImageUrl, pickContentImage, uploadContentImage } from "@/lib/contentImage";
import { errorMessage } from "@/lib/errors";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

type AdminCandidate = { id: number; name: string; image_path: string | null };
type AdminWorldcup = { id: number; title: string; candidates: AdminCandidate[] };

const THUMB = 64;

export default function AdminWorldcupImages() {
  // undefined = 불러오는 중
  const [cups, setCups] = useState<AdminWorldcup[] | undefined>(undefined);
  const [selected, setSelected] = useState<number | null>(null);
  // 올리는 중인 후보 (연타 방지)
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_get_worldcup_candidates");
    if (error) {
      setCups([]);
      showNotice("불러오지 못했어요", errorMessage(error));
      return;
    }
    const list = (data as AdminWorldcup[] | null) ?? [];
    setCups(list);
    setSelected((prev) => prev ?? list[0]?.id ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const upload = async (c: AdminCandidate) => {
    const image = await pickContentImage(true);
    if (!image) return;
    setBusy(c.id);
    try {
      const path = await uploadContentImage("worldcup", image);
      const { error } = await supabase.rpc("admin_set_candidate_image", { p_candidate_id: c.id, p_path: path });
      if (error) throw error;
      await load();
    } catch (e) {
      showNotice("사진을 올리지 못했어요", errorMessage(e as Error));
    } finally {
      setBusy(null);
    }
  };

  const remove = (c: AdminCandidate) =>
    showConfirm({
      title: `${c.name} 사진을 지울까요?`,
      message: "월드컵 화면에서 글자로만 보여요.",
      okLabel: "지우기",
      cancelLabel: "취소",
      destructive: true,
      onOk: async () => {
        setBusy(c.id);
        const { error } = await supabase.rpc("admin_set_candidate_image", { p_candidate_id: c.id, p_path: null });
        setBusy(null);
        if (error) {
          showNotice("지우지 못했어요", errorMessage(error));
          return;
        }
        load();
      },
    });

  if (cups === undefined) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "월드컵 사진" }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const cup = cups.find((c) => c.id === selected);
  const filled = cup ? cup.candidates.filter((c) => c.image_path).length : 0;

  return (
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "월드컵 사진" }} />

      <Text style={styles.hint}>
        후보마다 정사각형 사진을 올려요. 직접 찍었거나 무료로 쓸 수 있는 사진만 올려 주세요. 사진이 없는 후보는 글자로 보여요.
      </Text>

      {cups.length === 0 ? (
        <EmptyState title="월드컵이 없어요" emoji="🏆" />
      ) : (
        <>
          <View style={styles.chips}>
            {cups.map((c) => (
              <Chip key={c.id} label={c.title} selected={c.id === selected} onPress={() => setSelected(c.id)} />
            ))}
          </View>

          {cup && (
            <>
              <Text style={styles.hint}>
                사진 {filled} / {cup.candidates.length}
              </Text>
              {cup.candidates.map((c) => {
                const url = contentImageUrl(c.image_path);
                return (
                  <Card key={c.id}>
                    <View style={styles.row}>
                      {url ? (
                        <Image source={{ uri: url }} style={styles.thumb} contentFit="cover" />
                      ) : (
                        <View style={[styles.thumb, styles.empty]}>
                          <Text style={styles.emptyText}>없음</Text>
                        </View>
                      )}
                      <Text style={styles.name} numberOfLines={2}>
                        {c.name}
                      </Text>
                    </View>
                    <View style={styles.actions}>
                      {c.image_path && (
                        <Button
                          title="지우기"
                          variant="outline"
                          small
                          onPress={() => remove(c)}
                          disabled={busy === c.id}
                          style={styles.action}
                        />
                      )}
                      <Button
                        title={c.image_path ? "바꾸기" : "사진 올리기"}
                        variant="soft"
                        small
                        onPress={() => upload(c)}
                        loading={busy === c.id}
                        disabled={busy !== null && busy !== c.id}
                        style={styles.action}
                      />
                    </View>
                  </Card>
                );
              })}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  hint: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.sm,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  emptyText: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  name: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
});
