// ys-141 커뮤니티 글 · F-602 (투표 + 결과 + 계열·학년·성별·나이대 비교 + 댓글, ⋯ 메뉴: 수정·삭제·신고)
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import Comments from "@/components/community/Comments";
import PostCard from "@/components/community/PostCard";
import Chips from "@/components/create/Chips";
import { Bar, percent } from "@/components/results/QuestionResult";
import { colors, fontSize, spacing } from "@/constants/theme";
import type { Post } from "@/lib/community";
import { showActions, showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { GROUP_DIMS, type GroupDim, sortGroups } from "@/lib/hub";
import { showNotice } from "@/lib/notice";
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

  const p = post;

  // 오른쪽 위 ⋯: 내 글이면 내용 수정·삭제, 남의 글이면 신고
  const openMenu = () =>
    showActions(
      "글",
      p.mine
        ? [
            { label: "내용 수정", onPress: () => router.push({ pathname: "/community/edit", params: { id: String(p.id) } }) },
            {
              label: "삭제",
              destructive: true,
              onPress: () =>
                showConfirm({
                  title: "글을 지울까요?",
                  message: "지우면 되돌릴 수 없어요. 투표로 이미 받은 포인트는 그대로예요.",
                  okLabel: "삭제",
                  cancelLabel: "취소",
                  destructive: true,
                  onOk: async () => {
                    const { error } = await supabase.rpc("delete_post", { p_post_id: p.id });
                    if (error) {
                      showNotice("지우지 못했어요", errorMessage(error));
                      return;
                    }
                    router.back();
                  },
                }),
            },
          ]
        : [{ label: "신고", onPress: () => router.push({ pathname: "/report", params: { type: "post", id: String(p.id) } }) }],
    );

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen
        options={{
          title: "커뮤니티",
          headerRight: () => (
            <Pressable onPress={openMenu} hitSlop={8}>
              <Text style={styles.menu}>⋯</Text>
            </Pressable>
          ),
        }}
      />

      <PostCard post={post} onVoted={load} full />

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

      <Comments type="post" id={post.id} onChanged={load} />
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
  menu: {
    fontSize: fontSize.title,
    color: colors.text,
    paddingHorizontal: spacing.sm,
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
