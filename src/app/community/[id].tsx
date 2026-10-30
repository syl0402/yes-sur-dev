// ys-141 커뮤니티 글 · F-602 (투표 + 결과 + 계열·학년·성별·나이대 비교)
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import PostCard from "@/components/community/PostCard";
import Chips from "@/components/create/Chips";
import { Bar, percent } from "@/components/results/QuestionResult";
import { colors, fontSize, spacing } from "@/constants/theme";
import type { Post } from "@/lib/community";
import { errorMessage } from "@/lib/errors";
import { GROUP_DIMS, type GroupDim, sortGroups } from "@/lib/hub";
import { supabase } from "@/lib/supabase";

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // undefined = 불러오는 중, string = 오류 문구
  const [post, setPost] = useState<Post | string | undefined>(undefined);
  const [dim, setDim] = useState<GroupDim>("major");

  const load = useCallback(() => {
    supabase.rpc("get_post", { p_post_id: Number(id) }).then(({ data, error }) => {
      setPost(error ? errorMessage(error) : (data as Post));
    });
  }, [id]);

  useFocusEffect(load);

  if (post === undefined || typeof post === "string") {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "커뮤니티" }} />
        {post === undefined ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.muted}>{post}</Text>}
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "커뮤니티" }} />

      <PostCard post={post} onVoted={load} />

      {/* 그룹별 비교: 투표했거나 내 글일 때만 서버가 보낸다. 학교 비교는 하지 않는다 */}
      {post.groups ? (
        <View style={styles.box}>
          <Text style={styles.boxTitle}>그룹별로 보기</Text>
          <Chips options={GROUP_DIMS} selected={dim} onSelect={setDim} />
          {sortGroups(dim, post.groups[dim]).map((g) =>
            g.hidden || !g.counts ? (
              <Text key={g.label} style={styles.muted}>
                {g.label}: 5명 미만이라 숨겼어요
              </Text>
            ) : (
              <View key={g.label} style={styles.group}>
                <Text style={styles.groupTitle}>
                  {g.label} ({g.n}명)
                </Text>
                {post.options.map((label, i) => {
                  const counts = g.counts ?? [];
                  const total = counts.reduce((a, b) => a + b, 0);
                  return <Bar key={i} label={label} count={counts[i] ?? 0} pct={percent(counts[i] ?? 0, total)} />;
                })}
              </View>
            ),
          )}
        </View>
      ) : (
        <Text style={styles.muted}>투표하면 계열·학년·성별·나이대별 결과를 볼 수 있어요.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  muted: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    textAlign: "center",
  },
  box: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    gap: spacing.sm,
  },
  boxTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  group: {
    gap: 4,
    paddingTop: spacing.sm,
  },
  groupTitle: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.text,
  },
});
