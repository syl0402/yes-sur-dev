// ys-125 차단한 사용자 · F-602 (2026-11-16 커뮤니티 ④). 누구인지는 보여 주지 않고 "차단할 때 본 글/댓글 앞부분"만
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, spacing } from "@/constants/theme";
import type { MyBlock } from "@/lib/block";
import { showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

export default function Blocks() {
  // undefined = 불러오는 중
  const [blocks, setBlocks] = useState<MyBlock[] | undefined>(undefined);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("get_my_blocks");
    setBlocks((data as MyBlock[] | null) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const unblock = (b: MyBlock) =>
    showConfirm({
      title: "차단을 풀까요?",
      message: "이 사람의 글과 댓글이 다시 보여요.",
      okLabel: "풀기",
      cancelLabel: "취소",
      onOk: async () => {
        const { error } = await supabase.rpc("unblock", { p_id: b.id });
        if (error) {
          showNotice("풀지 못했어요", errorMessage(error));
          return;
        }
        load();
      },
    });

  return (
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "차단한 사용자" }} />
      <Text style={styles.hint}>차단한 사람의 글과 댓글은 보이지 않아요. 상대는 차단된 걸 알 수 없어요.</Text>
      {blocks === undefined ? (
        <ActivityIndicator color={colors.primary} />
      ) : blocks.length === 0 ? (
        <EmptyState title="차단한 사용자가 없어요" emoji="🙂" />
      ) : (
        blocks.map((b, i) => (
          <Card key={b.id}>
            <View style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.title}>차단한 사용자 {blocks.length - i}</Text>
                <Text style={styles.muted} numberOfLines={1}>
                  {b.context ? `"${b.context}" 에서 차단` : "차단한 글이 지워졌어요"}
                </Text>
                <Text style={styles.muted}>{formatDate(b.created_at)}</Text>
              </View>
              <Button title="풀기" variant="outline" small onPress={() => unblock(b)} />
            </View>
          </Card>
        ))
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
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  hint: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  muted: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
});
