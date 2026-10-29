// ys-150 마일리지 지갑 · F-701
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, fontSize, spacing } from "@/constants/theme";
import { showConfirm } from "@/lib/confirm";
import { formatDate, formatPoints } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { type SavedDraft, deleteDraft, listDrafts } from "@/lib/surveyDraft";

// TODO(임시): 포인트 내역은 최근 50개만 · 내역이 많아지면 아래로 내릴 때 더 불러오기 · docs/PROGRESS.md
const LEDGER_LIMIT = 50;

// 포인트 기록 이유 → 화면 문구
const REASON_LABELS: Record<string, string> = {
  welcome: "가입 축하",
  survey_reward: "설문 응답",
  survey_create: "설문 등록",
  data_view: "데이터 열람",
  balance_vote: "밸런스 투표",
};

type LedgerItem = {
  id: number;
  amount: number;
  label: string;
  date: string;
};

type MySurvey = {
  id: number;
  title: string;
  responseCount: number;
  target: number;
  closed: boolean;
};

type MyData = {
  userId: string;
  isOrg: boolean;
  name: string;
  schoolName: string;
  balance: number;
  ledger: LedgerItem[];
  surveys: MySurvey[];
  // 이 폰에 임시저장한 설문 (서버에는 없음)
  drafts: SavedDraft[];
};

// 내가 올린 설문 (최신순)
async function fetchMySurveys(userId: string): Promise<MySurvey[]> {
  if (!userId) return [];
  const { data } = await supabase
    .from("surveys")
    .select("id, title, response_count, target_responses, status, closes_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  const now = Date.now();
  return (data ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    responseCount: s.response_count,
    target: s.target_responses,
    closed: s.status !== "open" || (s.closes_at !== null && new Date(s.closes_at).getTime() <= now),
  }));
}

// 내 정보·잔액·포인트 내역·내 설문·임시저장 (모두 본인 것만 읽힌다)
async function fetchMy(): Promise<MyData> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? "";

  const [{ data: profile }, { data: org }, { data: balance }, { data: rows }, surveys] = await Promise.all([
    supabase.from("profiles").select("nickname, account_type, universities(name)").maybeSingle(),
    supabase.from("organizations").select("name").maybeSingle(),
    supabase.rpc("get_my_balance"),
    supabase
      .from("point_ledger")
      .select("id, amount, reason, ref_id, created_at")
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(LEDGER_LIMIT),
    fetchMySurveys(userId),
  ]);

  // 설문 응답·등록 기록에 설문 이름을 붙인다 (ref_id = 설문 번호)
  const surveyIds = (rows ?? [])
    // 설문 번호(숫자)인 기록만. 개발용 포인트 기록(ref_id "dev-…")은 빼고
    .filter((r) => (r.reason === "survey_reward" || r.reason === "survey_create") && /^\d+$/.test(r.ref_id ?? ""))
    .map((r) => Number(r.ref_id));
  const titles = new Map<string, string>();
  if (surveyIds.length > 0) {
    const { data: surveys } = await supabase.from("surveys").select("id, title").in("id", surveyIds);
    (surveys ?? []).forEach((s) => titles.set(String(s.id), s.title));
  }

  const rawSchool = profile?.universities as unknown;
  const school = (Array.isArray(rawSchool) ? rawSchool[0] : rawSchool) as { name: string } | null;

  return {
    userId,
    isOrg: profile?.account_type === "org",
    name: org?.name ?? profile?.nickname ?? "",
    schoolName: school?.name ?? "",
    balance: typeof balance === "number" ? balance : 0,
    ledger: (rows ?? []).map((r) => {
      const reason = REASON_LABELS[r.reason] ?? "기타";
      const title = r.ref_id ? titles.get(r.ref_id) : undefined;
      return {
        id: r.id,
        amount: r.amount,
        label: title ? `${reason} · ${title}` : reason,
        date: formatDate(r.created_at),
      };
    }),
    surveys,
    drafts: userId ? listDrafts(userId) : [],
  };
}

export default function My() {
  const [data, setData] = useState<MyData | null>(null);

  // 탭에 돌아올 때마다 새로 불러온다 (응답 후 내역이 바로 보이게)
  useFocusEffect(
    useCallback(() => {
      fetchMy().then(setData);
    }, []),
  );

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const removeDraft = (d: SavedDraft) =>
    showConfirm({
      title: "임시저장을 지울까요?",
      message: d.draft.title.trim() || "제목 없는 설문",
      okLabel: "지우기",
      cancelLabel: "취소",
      destructive: true,
      onOk: () => {
        if (!data) return;
        deleteDraft(data.userId, d.id);
        setData({ ...data, drafts: listDrafts(data.userId) });
      },
    });

  if (data === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
    >
      <View>
        <Text style={styles.name}>{data.name ? `${data.name}님` : ""}</Text>
        {data.schoolName ? <Text style={styles.school}>{data.schoolName}</Text> : null}
      </View>

      {data.isOrg ? (
        <View style={styles.pointBox}>
          <Text style={styles.orgNotice}>단체 계정은 포인트를 쓰지 않아요.</Text>
        </View>
      ) : (
        <>
          <View style={styles.pointBox}>
            <Text style={styles.pointLabel}>내 포인트</Text>
            <Text style={styles.pointValue}>{formatPoints(data.balance)}</Text>
          </View>

          <Text style={styles.sectionTitle}>포인트 내역</Text>
          {data.ledger.length === 0 ? (
            <Text style={styles.empty}>아직 포인트 내역이 없어요.</Text>
          ) : (
            data.ledger.map((item) => (
              <View key={item.id} style={styles.ledgerRow}>
                <View style={styles.ledgerMain}>
                  <Text style={styles.ledgerLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text style={styles.ledgerDate}>{item.date}</Text>
                </View>
                <Text style={[styles.ledgerAmount, item.amount < 0 && styles.ledgerMinus]}>
                  {item.amount > 0 ? "+" : "-"}
                  {formatPoints(Math.abs(item.amount))}
                </Text>
              </View>
            ))
          )}
        </>
      )}

      {/* 임시저장함: 이 폰에만 있고, 있을 때만 보인다 */}
      {data.drafts.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>임시저장한 설문</Text>
          {data.drafts.map((d) => (
            <Pressable
              key={d.id}
              style={styles.ledgerRow}
              onPress={() => router.push({ pathname: "/create", params: { draft: d.id } })}
            >
              <View style={styles.ledgerMain}>
                <Text style={styles.ledgerLabel} numberOfLines={1}>
                  {d.draft.title.trim() || "제목 없는 설문"}
                </Text>
                <Text style={styles.ledgerDate}>
                  {formatDate(d.savedAt)} 저장 · 문항 {d.draft.questions.length}개
                </Text>
              </View>
              <Pressable onPress={() => removeDraft(d)} hitSlop={8}>
                <Text style={styles.deleteText}>삭제</Text>
              </Pressable>
            </Pressable>
          ))}
          <Text style={styles.ledgerDate}>임시저장은 이 폰에만 있어요.</Text>
        </>
      )}

      <Text style={styles.sectionTitle}>내가 올린 설문</Text>
      {data.surveys.length === 0 ? (
        <Text style={styles.empty}>아직 올린 설문이 없어요.</Text>
      ) : (
        data.surveys.map((s) => (
          <Pressable
            key={s.id}
            style={styles.ledgerRow}
            onPress={() => router.push({ pathname: "/survey/[id]", params: { id: String(s.id) } })}
          >
            <View style={styles.ledgerMain}>
              <Text style={styles.ledgerLabel} numberOfLines={1}>
                {s.title}
              </Text>
              <Text style={styles.ledgerDate}>
                응답 {s.responseCount} / {s.target}명
              </Text>
            </View>
            <Text style={[styles.status, s.closed && styles.statusClosed]}>{s.closed ? "마감" : "진행 중"}</Text>
          </Pressable>
        ))
      )}

      <Pressable onPress={logout} style={styles.logout}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
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
    padding: spacing.lg,
    gap: spacing.md,
  },
  name: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
  },
  school: {
    marginTop: 4,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  pointBox: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    gap: 4,
  },
  pointLabel: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  pointValue: {
    fontSize: fontSize.hero,
    fontWeight: "800",
    color: colors.text,
  },
  orgNotice: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  sectionTitle: {
    marginTop: spacing.sm,
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  empty: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ledgerMain: {
    flex: 1,
    gap: 2,
  },
  ledgerLabel: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  ledgerDate: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  ledgerAmount: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.primary,
  },
  ledgerMinus: {
    color: colors.danger,
  },
  status: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.primary,
  },
  statusClosed: {
    color: colors.textMuted,
  },
  deleteText: {
    fontSize: fontSize.small,
    color: colors.danger,
  },
  logout: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    alignItems: "center",
  },
  logoutText: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
});
