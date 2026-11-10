// 홈 "취향 밸런스 인기 투표" (2026-11-10 피그마 홈 시안 145:3844)
// 커뮤니티 탭 HOT 목록(get_weekly_best)에서 투표형만 골라 6줄. 24시간 안에 올라온 글은 NEW
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import SectionHeader from "@/components/ui/SectionHeader";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { fetchHot, type HotItem, hotHref, KIND_LABELS } from "@/lib/community";

const COUNT = 6;
const NEW_MS = 24 * 60 * 60 * 1000;

// 설문 홍보 글은 투표가 아니라서 뺀다
function isVote(h: HotItem): boolean {
  return h.kind !== "promo";
}

function kindLabel(h: HotItem): string {
  return h.kind === "worldcup" ? "월드컵" : KIND_LABELS[h.kind];
}

function isNew(h: HotItem): boolean {
  return !!h.created_at && Date.now() - new Date(h.created_at).getTime() < NEW_MS;
}

export default function HomeHotVotes() {
  const [items, setItems] = useState<HotItem[]>([]);

  // 홈에 돌아올 때마다 새로 (투표 수가 바뀌니까). 실패하면 칸을 숨긴다
  useFocusEffect(
    useCallback(() => {
      fetchHot()
        .then((list) => setItems(list.filter(isVote).slice(0, COUNT)))
        .catch(() => setItems([]));
    }, []),
  );

  if (items.length === 0) return null;

  return (
    <View>
      <SectionHeader
        title="취향 밸런스 인기 투표"
        subtitle="이번 주 가장 많이 참여한 투표"
        actionLabel="전체 보기"
        onAction={() => router.navigate("/community")}
      />
      <View style={styles.card}>
        {items.map((h) => (
          <Pressable
            key={`${h.type}-${h.id}`}
            onPress={() => router.push(hotHref(h))}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={styles.kind}>{kindLabel(h)}</Text>
            <Text style={styles.question} numberOfLines={1}>
              {h.question}
            </Text>
            {isNew(h) && (
              <View style={styles.newBadge} accessibilityLabel="새 글">
                <Text style={styles.newText}>N</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 피그마 145:3841 값: Natural 50 바탕 · Natural 200 테두리 · 모서리 16 · 위아래 12 좌우 16 · 줄 사이 4
  card: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md - spacing.xs,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 24,
  },
  pressed: {
    opacity: 0.5,
  },
  // 종류 이름 칸 폭을 맞춰 질문 시작 위치를 줄 맞춤
  kind: {
    width: 64,
    fontSize: fontSize.caption,
    lineHeight: 20,
    fontWeight: "500",
    color: colors.primary,
  },
  question: {
    flex: 1,
    fontSize: fontSize.caption,
    lineHeight: 20,
    fontWeight: "500",
    color: colors.textMuted,
  },
  // 연한 빨강 동그라미 + 빨간 N (한국 앱의 익숙한 "새 글" 표시, 커뮤니티 HOT 뱃지와 같은 색. 2026-11-10 폰 확인 피드백: 더 연하게)
  newBadge: {
    width: 16,
    height: 16,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.hotSoft,
  },
  newText: {
    fontSize: fontSize.caption - 2,
    lineHeight: 12,
    fontWeight: "800",
    color: colors.hot,
  },
});
