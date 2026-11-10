// ys-161 통합 검색 (홈 오른쪽 위 돋보기에서. 설문 · 데이터 · 커뮤니티를 한 번에, 2026-11-10)
// 각 탭이 쓰는 목록을 그대로 불러와 앱에서 거른다 (DB 변경 없음)
// TODO(임시): 앱에서 거르기 · 콘텐츠가 수천 개가 되면 서버 검색(RPC)으로 바꾸기 · 테스트 기간 규모(수십~수백 개)에서는 충분
import { type Href, Stack, router } from "expo-router";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import Card from "@/components/ui/Card";
import ListRow, { rowsCard } from "@/components/ui/ListRow";
import { Text, TextInput } from "@/components/ui/Text";
import { myIcons, uiIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { KIND_LABELS, type Post } from "@/lib/community";
import { formatAgo, formatPoints, formatShortDate } from "@/lib/format";
import type { HubItem } from "@/lib/hub";
import { supabase } from "@/lib/supabase";
import { type SurveyCard, fetchOpenSurveys } from "@/lib/surveys";
import { formatTag, type Tag } from "@/lib/tags";

// 묶음마다 보여 줄 개수 (더 있으면 "○○ 탭에서 더 보기")
const PER_SECTION = 3;
// 입력이 멈추고 이만큼 지나면 찾는다
const DEBOUNCE_MS = 300;

type Sources = { surveys: SurveyCard[]; hub: HubItem[]; posts: Post[] };

const has = (text: string | null | undefined, q: string) => (text ?? "").toLowerCase().includes(q);
const tagHit = (tags: Tag[] | undefined, q: string) => (tags ?? []).some((t) => t.name.toLowerCase().includes(q));

export default function SearchScreen() {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [sources, setSources] = useState<Sources | null>(null);

  // 처음 한 번 세 목록을 불러온다
  useEffect(() => {
    Promise.all([
      fetchOpenSurveys(),
      supabase.rpc("get_hub_list", { p_category: null, p_sort: "latest" }),
      supabase.rpc("get_feed", { p_kind: null, p_sort: "latest" }),
    ]).then(([surveys, hub, feed]) => {
      setSources({
        surveys,
        hub: (hub.data as HubItem[] | null) ?? [],
        posts: (feed.data as Post[] | null) ?? [],
      });
    });
  }, []);

  // 입력이 멈추면 검색어 반영 (# 붙여도 태그로 찾게)
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim().replace(/^#/, "").toLowerCase()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  const found = useMemo(() => {
    if (!sources || q === "") return null;
    return {
      surveys: sources.surveys.filter((s) => has(s.title, q) || tagHit(s.tags, q)),
      hub: sources.hub.filter((h) => has(h.title, q) || tagHit(h.tags, q)),
      posts: sources.posts.filter((p) => has(p.question, q) || has(p.body, q)),
    };
  }, [sources, q]);

  // 아무것도 안 쳤을 때 보여 줄 인기 #태그 (진행 중 설문·결과에 많이 붙은 순)
  const popularTags = useMemo(() => {
    if (!sources) return [];
    const count = new Map<string, number>();
    for (const t of [...sources.surveys.flatMap((s) => s.tags), ...sources.hub.flatMap((h) => h.tags ?? [])]) {
      count.set(t.name, (count.get(t.name) ?? 0) + 1);
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name]) => name);
  }, [sources]);

  const total = found ? found.surveys.length + found.hub.length + found.posts.length : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: "검색" }} />

      <View style={styles.searchBox}>
        <AppIcon name={uiIcons.search} size={18} color={colors.textSubtle} />
        <TextInput
          style={styles.search}
          value={input}
          onChangeText={setInput}
          placeholder="설문 · 데이터 · 커뮤니티를 한 번에 찾아요"
          returnKeyType="search"
          autoCorrect={false}
          autoFocus
        />
        {input !== "" && (
          <Pressable onPress={() => setInput("")} hitSlop={8}>
            <Text style={styles.clear}>지우기</Text>
          </Pressable>
        )}
      </View>

      {sources === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : found === null ? (
        // 아직 안 쳤을 때: 인기 #태그
        popularTags.length > 0 && (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>많이 쓰인 태그</Text>
            <View style={styles.tags}>
              {popularTags.map((name) => (
                <Pressable key={name} onPress={() => setInput(`#${name}`)} style={styles.tag} hitSlop={4}>
                  <Text style={styles.tagText}>{formatTag(name)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )
      ) : total === 0 ? (
        <Text style={styles.empty}>‘{input.trim()}’에 맞는 결과가 없어요.{"\n"}다른 단어로 찾아보세요.</Text>
      ) : (
        <>
          <Section
            title="설문"
            count={found.surveys.length}
            more={{ label: "설문 탭에서 더 보기", href: { pathname: "/surveys", params: { q: input.trim() } } as Href }}
          >
            {found.surveys.slice(0, PER_SECTION).map((s, i) => (
              <ListRow
                key={s.id}
                first={i === 0}
                title={s.title}
                sub={`약 ${s.est_minutes}분 · ${formatPoints(s.reward_points)}${s.tags.length > 0 ? ` · ${s.tags.map((t) => formatTag(t.name)).join(" ")}` : ""}`}
                titleLines={2}
                onPress={() => router.push({ pathname: "/survey/[id]", params: { id: String(s.id) } })}
              />
            ))}
          </Section>
          <Section
            title="데이터"
            count={found.hub.length}
            more={{ label: "데이터 탭에서 더 보기", href: { pathname: "/data", params: { q: input.trim() } } as Href }}
          >
            {found.hub.slice(0, PER_SECTION).map((h, i) => (
              <ListRow
                key={h.id}
                first={i === 0}
                title={h.title}
                sub={`${h.category_name} · 응답 ${h.response_count}명 · ${formatShortDate(h.ended_at)} 마감`}
                titleLines={2}
                onPress={() => router.push({ pathname: "/data/[id]", params: { id: String(h.id) } })}
              />
            ))}
          </Section>
          <Section title="커뮤니티" count={found.posts.length} more={{ label: "커뮤니티 탭으로", href: "/community" as Href }}>
            {found.posts.slice(0, PER_SECTION).map((p, i) => (
              <ListRow
                key={p.id}
                first={i === 0}
                title={p.question}
                sub={`${KIND_LABELS[p.kind]} · 투표 ${p.votes} · 댓글 ${p.comment_count} · ${formatAgo(p.created_at)}`}
                titleLines={2}
                onPress={() => router.push({ pathname: "/community/[id]", params: { id: String(p.id) } })}
              />
            ))}
          </Section>
        </>
      )}
    </ScrollView>
  );
}

// 결과 묶음: 소제목 + 개수 · 카드 · 더 보기 (0개면 그리지 않음)
function Section({
  title,
  count,
  more,
  children,
}: {
  title: string;
  count: number;
  more: { label: string; href: Href };
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>
        {title} <Text style={styles.groupCount}>{count}</Text>
      </Text>
      <Card style={rowsCard}>{children}</Card>
      {count > PER_SECTION && (
        <Pressable onPress={() => router.navigate(more.href)} hitSlop={8} style={styles.more}>
          <Text style={styles.moreText}>{more.label}</Text>
          <AppIcon name={myIcons.forward} size={14} color={colors.primary} />
        </Pressable>
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
    padding: 20,
    paddingBottom: spacing.xl,
    gap: 24,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  search: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  clear: {
    fontSize: fontSize.caption,
    fontWeight: "600",
    color: colors.textMuted,
  },
  loading: {
    marginTop: spacing.lg,
  },
  group: {
    gap: spacing.sm,
  },
  groupTitle: {
    paddingHorizontal: spacing.xs,
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.textMuted,
  },
  groupCount: {
    fontWeight: "700",
    color: colors.primary,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tag: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  tagText: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.text,
  },
  empty: {
    marginTop: spacing.lg,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  more: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 2,
    paddingHorizontal: spacing.xs,
  },
  moreText: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.primary,
  },
});
