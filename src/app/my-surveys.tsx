// ys-163 내 설문 전체 · F-701 (2026-11-14 마이 탭 시안 ②: 마이 홈 "내 설문 → 전체 보기"에서)
// 요약 3칸(운영 중 · 받은 응답 · 결과 열람) → [진행 중 n | 마감 n] → 카드(마이 홈과 같은 카드)
// 응답 없이 마감된 설문: 회색 안내 + "다시 올리기 ›" (내용을 임시저장으로 가져와 작성 화면)
import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import MySurveyCard from "@/components/my/MySurveyCard";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import TextTabs from "@/components/ui/TextTabs";
import { colors, fontSize, spacing } from "@/constants/theme";
import { fetchMySurveys, type MySurvey } from "@/lib/mySurveys";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";
import { fetchSurveyAsDraft, makeRequestId, saveDraft } from "@/lib/surveyDraft";

export default function MySurveys() {
  const [surveys, setSurveys] = useState<MySurvey[] | null>(null);
  const [filter, setFilter] = useState<"open" | "closed">("open");
  const [copying, setCopying] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      supabase.auth.getUser().then(({ data }) => fetchMySurveys(data.user?.id ?? "").then(setSurveys));
    }, []),
  );

  // 다시 올리기: 마감된 설문 내용을 임시저장으로 만들어 작성 화면으로 (원래 설문은 그대로)
  const reupload = async (s: MySurvey) => {
    if (copying !== null) return;
    setCopying(s.id);
    const [{ data: auth }, draft] = await Promise.all([supabase.auth.getUser(), fetchSurveyAsDraft(s.id)]);
    setCopying(null);
    const userId = auth.user?.id;
    if (!userId || !draft) {
      showNotice("불러오지 못했어요", "잠시 후 다시 시도해 주세요.");
      return;
    }
    const id = makeRequestId();
    saveDraft(userId, id, draft, 1);
    router.push({ pathname: "/create", params: { draft: id } });
  };

  if (surveys === null) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "내 설문" }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const open = surveys.filter((s) => !s.closed);
  const closed = surveys.filter((s) => s.closed);
  const shown = filter === "open" ? open : closed;
  const openCount = surveys.filter((s) => !s.closed && !s.moderated).length;
  const responses = surveys.reduce((sum, s) => sum + s.responseCount, 0);
  const views = surveys.reduce((sum, s) => sum + (s.hubViews ?? 0), 0);

  return (
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "내 설문" }} />

      {/* 요약 3칸 */}
      <Card style={styles.summary}>
        {[
          { label: "운영 중", value: openCount, strong: true },
          { label: "받은 응답", value: responses },
          { label: "결과 열람", value: views },
        ].map((m, i) => (
          <View key={m.label} style={[styles.cell, i > 0 && styles.cellLine]}>
            <Text style={[styles.cellValue, m.strong && styles.cellStrong]}>{m.value}</Text>
            <Text style={styles.cellLabel}>{m.label}</Text>
          </View>
        ))}
      </Card>

      {surveys.length === 0 ? (
        <EmptyState title="아직 올린 설문이 없어요" message="궁금한 걸 대학생들에게 물어보세요." emoji="📣" />
      ) : (
        <>
          <TextTabs
            options={[
              { value: "open", label: `진행 중 ${open.length}` },
              { value: "closed", label: `마감 ${closed.length}` },
            ]}
            value={filter}
            onChange={setFilter}
            fill
          />
          {shown.length === 0 ? (
            <Text style={styles.empty}>{filter === "open" ? "진행 중인 설문이 없어요." : "마감된 설문이 없어요."}</Text>
          ) : (
            shown.map((s) => (
              <View key={s.id} style={styles.item}>
                <MySurveyCard survey={s} />
                {/* 응답 없이 마감: 회색 안내 + 다시 올리기 */}
                {s.closed && s.responseCount === 0 && !s.moderated && (
                  <View style={styles.noResponse}>
                    <Text style={styles.noResponseText}>응답 없이 마감됐어요</Text>
                    <Pressable onPress={() => reupload(s)} hitSlop={8} disabled={copying !== null}>
                      <Text style={styles.link}>{copying === s.id ? "불러오는 중…" : "다시 올리기 ›"}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))
          )}
        </>
      )}

      <Button title="+ 새 설문 등록" variant="soft" onPress={() => router.push("/create")} />
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
  summary: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 0,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  cellLine: {
    borderLeftWidth: 1,
    borderLeftColor: colors.surfaceMuted,
  },
  cellValue: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  cellStrong: {
    color: colors.primary,
  },
  cellLabel: {
    fontSize: fontSize.caption,
    color: colors.iconStrong,
  },
  empty: {
    paddingVertical: spacing.md,
    fontSize: fontSize.small,
    color: colors.textMuted,
    textAlign: "center",
  },
  item: {
    gap: spacing.xs,
  },
  noResponse: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs,
  },
  noResponseText: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  link: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.text,
  },
});
