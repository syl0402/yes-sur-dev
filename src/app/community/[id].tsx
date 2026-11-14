// ys-141 커뮤니티 글 · F-602 (투표 + 결과 + 계열·학년·성별·나이대 비교 + 댓글, ⋯ 메뉴: 수정·삭제·신고)
// 2026-11-14 커뮤니티 시안 ②: 큰 줄다리기 막대 · 그룹별로 보기는 데이터 허브와 같은 묶음 비교 막대 · 댓글에 고른 편 배지
// 2026-11-14 결과 공유 이미지: 오른쪽 위 공유 아이콘 (결과를 볼 수 있을 때만, 설문 홍보 글 제외)
import {
  Stack,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import AppIcon from "@/components/AppIcon";
import CommentComposer from "@/components/community/CommentComposer";
import Comments from "@/components/community/Comments";
import PostCard from "@/components/community/PostCard";
import GroupCompare, {
  DimChips,
  FocusChips,
} from "@/components/results/GroupCompare";
import { percent } from "@/components/results/QuestionResult";
import {
  ShareBalance,
  SharePick,
} from "@/components/share/CommunityShareCards";
import SharePreviewSheet from "@/components/share/SharePreviewSheet";
import { Text } from "@/components/ui/Text";
import { uiIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { KIND_LABELS, type Post } from "@/lib/community";
import { showActions, showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { GROUP_DIMS, type GroupDim, sortGroups } from "@/lib/hub";
import { showNotice } from "@/lib/notice";
import { useCommentThread } from "@/hooks/useCommentThread";
import { fetchRules } from "@/lib/rules";
import { supabase } from "@/lib/supabase";

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // undefined = 불러오는 중, string = 오류 문구
  const [post, setPost] = useState<Post | string | undefined>(undefined);
  const [dim, setDim] = useState<GroupDim>("major");
  // 그룹별로 보기에서 볼 보기 (처음엔 가장 많이 고른 보기)
  const [focus, setFocus] = useState<number | null>(null);
  // 이 인원 미만 그룹은 흐리게 (point_rules low_response_warning)
  const [fewUnder, setFewUnder] = useState(10);

  useEffect(() => {
    fetchRules(["low_response_warning"]).then((r) =>
      setFewUnder(r.low_response_warning ?? 10),
    );
  }, []);

  const load = useCallback(() => {
    supabase
      .rpc("get_post", { p_post_id: Number(id) })
      .then(({ data, error }) => {
        setPost(error ? errorMessage(error) : (data as Post));
      });
  }, [id]);

  useFocusEffect(load);
  // 댓글 (목록 + 아래 고정 입력칸). 댓글을 달면 글도 다시 불러온다 (댓글 수)
  const thread = useCommentThread("post", Number(id), load);
  // 공유 미리보기 창
  const [shareOpen, setShareOpen] = useState(false);

  if (post === undefined || typeof post === "string") {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "커뮤니티" }} />
        {post === undefined ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.muted}>{post}</Text>
        )}
      </View>
    );
  }

  const p = post;
  // 결과를 볼 수 있는 투표 글만 공유 (설문 홍보는 공유 이미지 없음)
  const canShare = p.kind !== "promo" && p.counts !== null;
  const isDuel =
    (p.kind === "balance" || p.kind === "relate") && p.options.length === 2;
  const counts = post.counts ?? [];
  const total = counts.reduce((a, b) => a + b, 0);
  const topIndex = counts.length > 0 ? counts.indexOf(Math.max(...counts)) : 0;
  const focusIndex = focus ?? topIndex;

  // 오른쪽 위 ⋯: 내 글이면 내용 수정·삭제, 남의 글이면 신고
  const openMenu = () =>
    showActions(
      "글",
      p.mine
        ? [
            {
              label: "내용 수정",
              onPress: () =>
                router.push({
                  pathname: "/community/edit",
                  params: { id: String(p.id) },
                }),
            },
            {
              label: "삭제",
              destructive: true,
              onPress: () =>
                showConfirm({
                  title: "글을 지울까요?",
                  message:
                    "지우면 되돌릴 수 없어요. 투표로 이미 받은 포인트는 그대로예요.",
                  okLabel: "삭제",
                  cancelLabel: "취소",
                  destructive: true,
                  onOk: async () => {
                    const { error } = await supabase.rpc("delete_post", {
                      p_post_id: p.id,
                    });
                    if (error) {
                      showNotice("지우지 못했어요", errorMessage(error));
                      return;
                    }
                    router.back();
                  },
                }),
            },
          ]
        : [
            {
              label: "신고",
              onPress: () =>
                router.push({
                  pathname: "/report",
                  params: { type: "post", id: String(p.id) },
                }),
            },
          ],
    );

  return (
    <View style={styles.screen}>
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
              <View style={styles.headerButtons}>
                {canShare && (
                  <Pressable
                    onPress={() => setShareOpen(true)}
                    hitSlop={8}
                    accessibilityLabel="결과 공유"
                  >
                    <AppIcon
                      name={uiIcons.share}
                      size={22}
                      color={colors.text}
                    />
                  </Pressable>
                )}
                <Pressable
                  onPress={openMenu}
                  hitSlop={8}
                  accessibilityLabel="더보기"
                >
                  <Text style={styles.menu}>⋯</Text>
                </Pressable>
              </View>
            ),
          }}
        />

        <PostCard post={post} onVoted={load} full />

        {/* 그룹별 비교: 투표했거나 내 글일 때만 서버가 보낸다. 학교 비교는 하지 않는다 */}
        {post.groups ? (
          <View style={styles.box}>
            <Text style={styles.boxTitle}>그룹별로 보기</Text>
            <DimChips options={GROUP_DIMS} value={dim} onChange={setDim} />
            {post.options.length > 1 && (
              <FocusChips
                options={post.options.map((label, i) => ({ value: i, label }))}
                value={focusIndex}
                onChange={setFocus}
              />
            )}
            {(() => {
              const groups = sortGroups(dim, post.groups[dim]);
              const shown = groups.filter(
                (g) => !g.hidden && g.counts && (g.n ?? 0) > 0,
              );
              const hidden = groups.filter((g) => g.hidden || !g.counts);
              return (
                <>
                  {shown.length > 0 ? (
                    <GroupCompare
                      title={
                        <>
                          <Text style={styles.strong}>
                            ‘{post.options[focusIndex]}’
                          </Text>
                          를 고른 비율
                        </>
                      }
                      rows={shown.map((g) => {
                        const c = g.counts ?? [];
                        const n = c.reduce((x, y) => x + y, 0);
                        return {
                          label: g.label,
                          n,
                          value: percent(c[focusIndex] ?? 0, n),
                        };
                      })}
                      fewUnder={fewUnder}
                      overall={percent(counts[focusIndex] ?? 0, total)}
                      overallLabel="전체"
                    />
                  ) : (
                    <Text style={styles.muted}>
                      아직 보여 줄 수 있는 그룹이 없어요.
                    </Text>
                  )}
                  {hidden.length > 0 && (
                    <Text style={styles.hiddenNote}>
                      5명 미만이라 숨김: {hidden.map((g) => g.label).join(", ")}
                    </Text>
                  )}
                </>
              );
            })()}
          </View>
        ) : post.kind === "promo" ? null : (
          <Text style={styles.muted}>
            투표하면 계열·학년·성별·나이대별 결과를 볼 수 있어요.
          </Text>
        )}

        <Comments
          thread={thread}
          sides={post.kind === "promo" ? undefined : post.options}
        />
      </ScrollView>
      <CommentComposer thread={thread} />

      {/* 공유 미리보기 창 (1080×1080 이미지) */}
      {shareOpen && canShare && p.counts && (
        <SharePreviewSheet
          shape="square"
          kind={isDuel ? "balance" : "pick"}
          onClose={() => setShareOpen(false)}
          renderCard={(width, ref) =>
            isDuel ? (
              <ShareBalance
                ref={ref}
                width={width}
                data={{
                  kindLabel: KIND_LABELS[p.kind],
                  question: p.question,
                  labels: [p.options[0], p.options[1]],
                  counts: [p.counts?.[0] ?? 0, p.counts?.[1] ?? 0],
                  mine: p.my_choice,
                  suffix: p.kind === "balance",
                }}
              />
            ) : (
              <SharePick
                ref={ref}
                width={width}
                data={{
                  question: p.question,
                  options: p.options,
                  counts: p.counts ?? [],
                  mine: p.my_choice,
                }}
              />
            )
          }
        />
      )}
    </View>
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
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
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
  // 시안: 연한 회색 상자 (Natural 50)
  box: {
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSubtle,
    gap: 12,
  },
  strong: {
    fontWeight: "700",
  },
  hiddenNote: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  boxTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
});
