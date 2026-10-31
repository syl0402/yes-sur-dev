// ys-180 운영자 화면 · F-704 (팀 운영자 계정만. [신고 | 의견 | 단체] 처리, 2026-10-31)
import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import LinkedText from "@/components/LinkedText";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Segmented from "@/components/ui/Segmented";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import {
  type AdminCounts,
  FEEDBACK_CATEGORY_LABELS,
  type PendingFeedback,
  type PendingOrg,
  REPORT_REASON_LABELS,
  REPORT_TYPE_LABELS,
  type ReportGroup,
} from "@/lib/admin";
import { showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

type Tab = "reports" | "feedback" | "orgs";

// 대상의 지금 상태 → 뱃지
const MODERATION_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  visible: { label: "보이는 중", tone: "muted" },
  hidden: { label: "자동 숨김", tone: "danger" },
  removed: { label: "삭제됨", tone: "muted" },
  deleted: { label: "작성자가 지움", tone: "muted" },
};

export default function Admin() {
  // undefined = 불러오는 중, null = 운영자 아님
  const [counts, setCounts] = useState<AdminCounts | null | undefined>(undefined);
  const [reports, setReports] = useState<ReportGroup[]>([]);
  const [feedback, setFeedback] = useState<PendingFeedback[]>([]);
  const [orgs, setOrgs] = useState<PendingOrg[]>([]);
  const [tab, setTab] = useState<Tab>("reports");
  // 처리 중인 대상 (연타 방지)
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const { data: c, error } = await supabase.rpc("admin_get_counts");
    if (error) {
      setCounts(null);
      return;
    }
    setCounts(c as AdminCounts);
    const [{ data: r }, { data: f }, { data: o }] = await Promise.all([
      supabase.rpc("admin_get_reports"),
      supabase.rpc("admin_get_feedback"),
      supabase.rpc("admin_get_pending_orgs"),
    ]);
    setOrgs((o as PendingOrg[] | null) ?? []);
    setReports((r as ReportGroup[] | null) ?? []);
    setFeedback((f as PendingFeedback[] | null) ?? []);
  }, []);

  // 화면에 돌아올 때마다 새로 (답변·거절 사유 화면에서 돌아왔을 때)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const resolve = (g: ReportGroup, action: "keep" | "remove") => {
    const run = async () => {
      setBusy(`${g.type}:${g.id}`);
      const { error } = await supabase.rpc("admin_resolve_report", { p_type: g.type, p_id: g.id, p_action: action });
      setBusy("");
      if (error) {
        showNotice("처리하지 못했어요", errorMessage(error));
        return;
      }
      load();
    };
    showConfirm(
      action === "keep"
        ? {
            title: "문제없음으로 처리할까요?",
            message: "숨겨져 있었다면 다시 보이고, 신고는 닫혀요.",
            okLabel: "문제없음",
            cancelLabel: "취소",
            onOk: run,
          }
        : {
            title: "삭제할까요?",
            message: `이 ${REPORT_TYPE_LABELS[g.type]}이(가) 앱에서 내려가요. 되돌리려면 Supabase에서 바꿔야 해요.`,
            okLabel: "삭제",
            cancelLabel: "취소",
            destructive: true,
            onOk: run,
          },
    );
  };

  const approve = (o: PendingOrg) =>
    showConfirm({
      title: `${o.name}을(를) 승인할까요?`,
      message: "승인하면 단체 이름으로 설문을 올릴 수 있어요.",
      okLabel: "승인",
      cancelLabel: "취소",
      onOk: async () => {
        setBusy(o.id);
        const { error } = await supabase.rpc("admin_decide_org", { p_user_id: o.id, p_approve: true });
        setBusy("");
        if (error) {
          showNotice("처리하지 못했어요", errorMessage(error));
        }
        load();
      },
    });

  if (counts === undefined) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "운영" }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // 운영자가 아니면 (서버가 거절) 안내만
  if (counts === null) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "운영" }} />
        <EmptyState title="운영자만 볼 수 있어요" emoji="🔒" />
      </View>
    );
  }

  const tabs: { value: Tab; label: string }[] = [
    { value: "reports", label: `신고 ${counts.reports}` },
    { value: "feedback", label: `의견 ${counts.feedback}` },
    { value: "orgs", label: `단체 ${counts.orgs}` },
  ];

  return (
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "운영" }} />

      <Segmented options={tabs} value={tab} onChange={setTab} />

      {tab === "reports" &&
        (reports.length === 0 ? (
          <EmptyState title="처리할 신고가 없어요" emoji="✅" />
        ) : (
          reports.map((g) => {
            const key = `${g.type}:${g.id}`;
            const state = MODERATION_BADGE[g.moderation ?? ""] ?? null;
            const closedByAuthor = g.moderation === "deleted" || g.moderation === "removed";
            return (
              <Card key={key}>
                <View style={styles.top}>
                  <View style={styles.badges}>
                    <Badge label={REPORT_TYPE_LABELS[g.type]} />
                    {state && <Badge label={state.label} tone={state.tone} />}
                  </View>
                  <Text style={styles.count}>신고 {g.count}건</Text>
                </View>

                <Text style={styles.title}>{g.title ?? "(내용 없음)"}</Text>
                {g.options && <Text style={styles.muted}>보기: {g.options.join(" / ")}</Text>}
                {g.body ? (
                  <Text style={styles.body} numberOfLines={6}>
                    {g.body}
                  </Text>
                ) : null}
                {g.type === "comment" && (
                  <Text style={styles.muted}>
                    {g.parent_type === "daily" ? "오늘의 질문" : `글 #${g.parent_id}`}에 달린 댓글
                  </Text>
                )}

                <View style={styles.reasonBox}>
                  <Text style={styles.reasonText}>
                    사유: {g.reasons.map((r) => REPORT_REASON_LABELS[r] ?? r).join(" · ")}
                  </Text>
                  {(g.details ?? []).map((d, i) => (
                    <Text key={i} style={styles.detail}>
                      “{d}”
                    </Text>
                  ))}
                  <Text style={styles.muted}>마지막 신고 {formatDate(g.last_at)}</Text>
                </View>

                <View style={styles.actions}>
                  <Button
                    title={closedByAuthor ? "신고 닫기" : "문제없음"}
                    variant="outline"
                    small
                    onPress={() => resolve(g, "keep")}
                    disabled={busy === key}
                    style={styles.action}
                  />
                  {!closedByAuthor && (
                    <Button
                      title="삭제"
                      small
                      onPress={() => resolve(g, "remove")}
                      loading={busy === key}
                      style={styles.action}
                    />
                  )}
                </View>
              </Card>
            );
          })
        ))}

      {/* 의견: 오래된 것부터. 보낸 사람은 보이지 않는다 */}
      {tab === "feedback" &&
        (feedback.length === 0 ? (
          <EmptyState title="답변할 의견이 없어요" emoji="✅" />
        ) : (
          feedback.map((f) => (
            <Card key={f.id}>
              <View style={styles.top}>
                <Badge label={FEEDBACK_CATEGORY_LABELS[f.category] ?? "기타"} />
                <Text style={styles.muted}>{formatDate(f.created_at)}</Text>
              </View>
              <Text style={styles.feedbackBody}>{f.body}</Text>
              <Text style={styles.muted}>
                {[
                  f.screen && `보낸 화면: ${f.screen}`,
                  [f.device.model, f.device.os && `${f.device.os} ${f.device.osVersion ?? ""}`.trim()]
                    .filter(Boolean)
                    .join(" · "),
                  f.device.appVersion && `앱 ${f.device.appVersion}`,
                ]
                  .filter(Boolean)
                  .join("\n")}
              </Text>
              <Button
                title="답변 쓰기"
                variant="soft"
                small
                onPress={() => router.push({ pathname: "/admin/reply", params: { id: String(f.id), body: f.body } })}
              />
            </Card>
          ))
        ))}

      {/* 단체: 먼저 신청한 순. 증빙 링크·가입 메일로 공식 단체인지 확인 */}
      {tab === "orgs" &&
        (orgs.length === 0 ? (
          <EmptyState title="승인 대기 단체가 없어요" emoji="✅" />
        ) : (
          orgs.map((o) => (
            <Card key={o.id}>
              <View style={styles.top}>
                <Badge label={o.kind === "campus" ? "교내 단체" : "외부 단체"} tone={o.kind === "campus" ? "primary" : "accent"} />
                <Text style={styles.muted}>{formatDate(o.created_at)} 신청</Text>
              </View>
              <Text style={styles.title}>{o.name}</Text>
              {o.school ? <Text style={styles.muted}>{o.school}</Text> : null}
              {o.description ? <Text style={styles.feedbackBody}>{o.description}</Text> : null}
              <View style={styles.reasonBox}>
                <Text style={styles.reasonText}>증빙 링크</Text>
                <LinkedText style={styles.detail}>{o.evidence_url}</LinkedText>
                <Text style={styles.reasonText}>가입 메일</Text>
                <Text style={styles.detail} selectable>
                  {o.email ?? "-"}
                </Text>
              </View>
              <View style={styles.actions}>
                <Button
                  title="거절"
                  variant="outline"
                  small
                  onPress={() => router.push({ pathname: "/admin/reject", params: { id: o.id, name: o.name } })}
                  disabled={busy === o.id}
                  style={styles.action}
                />
                <Button title="승인" small onPress={() => approve(o)} loading={busy === o.id} style={styles.action} />
              </View>
            </Card>
          ))
        ))}
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
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badges: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  count: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.danger,
  },
  title: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  body: {
    fontSize: fontSize.small,
    color: colors.text,
    lineHeight: 19,
  },
  muted: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  feedbackBody: {
    fontSize: fontSize.body,
    color: colors.text,
    lineHeight: 24,
  },
  reasonBox: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  reasonText: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.text,
  },
  detail: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
});
