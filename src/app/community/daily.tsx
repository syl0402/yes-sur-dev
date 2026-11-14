// ys-144 오늘의 질문 상세 · F-604 (홈 카드에서. 답하기 + 계열·학년·성별·나이대 비교 + 댓글. 오늘 것만)
// 2026-11-14 결과 공유 이미지: 답한 뒤 오른쪽 위 공유 아이콘 (밸런스 틀)
import { Stack } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";

import CommentComposer from "@/components/community/CommentComposer";
import Comments from "@/components/community/Comments";
import Chips from "@/components/create/Chips";
import DailyCard, { type Daily } from "@/components/DailyCard";
import { Bar, percent } from "@/components/results/QuestionResult";
import { ShareBalance } from "@/components/share/CommunityShareCards";
import SharePreviewSheet from "@/components/share/SharePreviewSheet";
import { Text } from "@/components/ui/Text";
import { uiIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { useCommentThread } from "@/hooks/useCommentThread";
import { GROUP_DIMS, type GroupDim, sortGroups } from "@/lib/hub";

export default function TodayDaily() {
  // undefined = 불러오는 중, null = 오늘 질문 없음
  const [daily, setDaily] = useState<Daily | null | undefined>(undefined);
  const [dim, setDim] = useState<GroupDim>("major");

  // DailyCard가 불러올 때마다 (답한 뒤 포함) 받아서 그룹별 결과를 그린다
  const onLoaded = useCallback((d: Daily | null) => setDaily(d), []);
  // 댓글 (목록 + 아래 고정 입력칸)
  const thread = useCommentThread("daily", daily?.id ?? null);
  // 공유 이미지 (답해서 결과를 볼 수 있을 때만)
  const [shareOpen, setShareOpen] = useState(false);
  const canShare = !!daily && daily.a !== null && daily.b !== null;

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
            title: "오늘의 질문",
            headerRight: canShare
              ? () => (
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
                )
              : undefined,
          }}
        />

        <DailyCard onLoaded={onLoaded} />

        {daily === null && (
          <Text style={styles.muted}>
            오늘은 질문이 없어요. 내일 다시 와 주세요!
          </Text>
        )}

        {daily && daily.groups && (
          <View style={styles.box}>
            <Text style={styles.boxTitle}>그룹별로 보기</Text>
            <Chips options={GROUP_DIMS} selected={dim} onSelect={setDim} />
            {sortGroups(dim, daily.groups[dim]).map((g) =>
              g.hidden || !g.counts ? (
                <Text key={g.label} style={styles.muted}>
                  {g.label}: 5명 미만이라 숨겼어요
                </Text>
              ) : (
                <View key={g.label} style={styles.group}>
                  <Text style={styles.groupTitle}>
                    {g.label} ({g.n}명)
                  </Text>
                  {[daily.option_a, daily.option_b].map((label, i) => {
                    const counts = g.counts ?? [];
                    const total = counts.reduce((a, b) => a + b, 0);
                    return (
                      <Bar
                        key={i}
                        label={label}
                        count={counts[i] ?? 0}
                        pct={percent(counts[i] ?? 0, total)}
                      />
                    );
                  })}
                </View>
              ),
            )}
          </View>
        )}

        {daily && !daily.my_choice && (
          <Text style={styles.muted}>
            답하면 계열·학년·성별·나이대별 결과를 볼 수 있어요.
          </Text>
        )}

        {daily && <Comments thread={thread} />}
      </ScrollView>
      {daily && <CommentComposer thread={thread} />}

      {/* 공유 미리보기 창 (1080×1080 이미지) */}
      {shareOpen && canShare && daily && (
        <SharePreviewSheet
          shape="square"
          kind="daily"
          onClose={() => setShareOpen(false)}
          renderCard={(width, ref) => (
            <ShareBalance
              ref={ref}
              width={width}
              data={{
                kindLabel: "오늘의 질문",
                question: daily.question,
                labels: [daily.option_a, daily.option_b],
                counts: [daily.a ?? 0, daily.b ?? 0],
                mine:
                  daily.my_choice === "a"
                    ? 0
                    : daily.my_choice === "b"
                      ? 1
                      : null,
                suffix: true,
              }}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
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
