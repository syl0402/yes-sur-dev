// ys-150 마일리지 지갑 · F-701 (2026-10-31 디자인: 프로필 · 포인트 카드 · 탭 전환 [내 설문 | 포인트 내역 | 내 데이터], 2026-11-09 열람한 결과 → 내 데이터)
import { type Href, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import { listCardStyles as list } from "@/components/listCardStyles";
import MyDataPanel from "@/components/MyDataPanel";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ProgressBar from "@/components/ui/ProgressBar";
import { Text } from "@/components/ui/Text";
import Segmented from "@/components/ui/Segmented";
import TextTabs from "@/components/ui/TextTabs";
import { type IconName, myIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { type AdminCounts, fetchAdminCounts, totalPending } from "@/lib/admin";
import { showConfirm } from "@/lib/confirm";
import { formatDate, formatPoints, formatShortDate } from "@/lib/format";
import type { HubItem } from "@/lib/hub";
import { supabase } from "@/lib/supabase";
import { type ResultVisibility, type SavedDraft, VISIBILITY_LABELS, deleteDraft, listDrafts } from "@/lib/surveyDraft";

// 내 정보 화면 (account/index.tsx). 개발 서버가 경로 목록을 늦게 갱신해 타입 오류가 나는 일이 있어 Href로 고정
const ACCOUNT_HREF = "/account" as Href;
// 운영자 화면 (admin/index.tsx). 같은 이유로 Href로 고정
const ADMIN_HREF = "/admin" as Href;
// 내가 쓴 글 (my-posts.tsx, 2026-11-10). 같은 이유로 Href로 고정
const MY_POSTS_HREF = "/my-posts" as Href;

// TODO(임시): 포인트 내역은 최근 50개만 · 내역이 많아지면 아래로 내릴 때 더 불러오기 · docs/PROGRESS.md
const LEDGER_LIMIT = 50;

// 포인트 기록 이유 → 화면 문구
const REASON_LABELS: Record<string, string> = {
  welcome: "가입 축하",
  survey_reward: "설문 응답",
  survey_create: "설문 등록",
  survey_refund: "설문 마감 환불",
  survey_delete: "설문 삭제 환불",
  data_view: "데이터 열람",
  data_share: "열람 수익",
  balance_vote: "밸런스 투표",
  daily_question: "오늘의 질문",
  streak_bonus: "연속 출석 보너스",
  community: "커뮤니티 투표",
  creator_bonus: "내 투표 인기 보너스",
  invite: "친구 초대",
};

type Tab = "surveys" | "ledger" | "data";

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
  // 신고로 숨겨짐(운영자 확인 중) 또는 운영자가 삭제
  moderated: boolean;
  // 데이터 탭에 공개된 결과면 열람 수, 아니면 null (2026-11-09 개인 피드백 12번)
  hubViews: number | null;
  createdAt: string;
  visibility: ResultVisibility;
};

type MyData = {
  userId: string;
  isOrg: boolean;
  // 학생인데 성별·출생연도가 비어 있음 (기능 추가 전 가입) → 한 번만 입력
  needsDemographics: boolean;
  name: string;
  balance: number;
  ledger: LedgerItem[];
  surveys: MySurvey[];
  // 이 폰에 임시저장한 설문 (서버에는 없음)
  drafts: SavedDraft[];
  // 운영자 계정이면 처리 대기 건수, 아니면 null
  admin: AdminCounts | null;
};

// 내가 올린 설문 (최신순) + 데이터 탭에 공개됐는지 (데이터 탭과 같은 get_hub_list에서 mine인 것)
async function fetchMySurveys(userId: string): Promise<MySurvey[]> {
  if (!userId) return [];
  const [{ data }, { data: hub }] = await Promise.all([
    supabase
      .from("surveys")
      .select("id, title, response_count, target_responses, status, closes_at, moderation, created_at, result_visibility")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    supabase.rpc("get_hub_list", { p_category: null, p_sort: "latest" }),
  ]);
  const hubViews = new Map(((hub as HubItem[] | null) ?? []).filter((h) => h.mine).map((h) => [h.id, h.view_count]));
  const now = Date.now();
  return (data ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    responseCount: s.response_count,
    target: s.target_responses,
    closed: s.status !== "open" || (s.closes_at !== null && new Date(s.closes_at).getTime() <= now),
    moderated: s.moderation !== "visible",
    createdAt: s.created_at,
    visibility: s.result_visibility,
    hubViews: hubViews.get(s.id) ?? null,
  }));
}

// 내 정보·잔액·포인트 내역·내 설문·임시저장 (모두 본인 것만 읽힌다)
async function fetchMy(): Promise<MyData> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? "";

  const [{ data: profile }, { data: org }, { data: balance }, { data: rows }, surveys, admin] = await Promise.all([
    supabase.from("profiles").select("nickname, account_type, gender, birth_year").maybeSingle(),
    supabase.from("organizations").select("name").maybeSingle(),
    supabase.rpc("get_my_balance"),
    supabase
      .from("point_ledger")
      .select("id, amount, reason, ref_id, created_at")
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(LEDGER_LIMIT),
    fetchMySurveys(userId),
    fetchAdminCounts(),
  ]);

  // 설문 관련 기록에 설문 이름을 붙인다 (ref_id = 설문 번호, 열람 수익은 "설문번호:열람번호")
  const surveyIds = (rows ?? [])
    // 설문 번호가 있는 기록만. 개발용 포인트 기록(ref_id "dev-…")은 빼고
    .map((r) => surveyIdOf(r.ref_id))
    .filter((sid): sid is number => sid !== null);
  const titles = new Map<string, string>();
  if (surveyIds.length > 0) {
    const { data: found } = await supabase.from("surveys").select("id, title").in("id", surveyIds);
    (found ?? []).forEach((s) => titles.set(String(s.id), s.title));
  }

  const isOrg = profile?.account_type === "org";

  return {
    userId,
    isOrg,
    needsDemographics: !isOrg && (profile?.gender == null || profile?.birth_year == null),
    name: org?.name ?? profile?.nickname ?? "",
    balance: typeof balance === "number" ? balance : 0,
    ledger: (rows ?? []).map((r) => {
      const reason = REASON_LABELS[r.reason] ?? "기타";
      const sid = surveyIdOf(r.ref_id);
      const title = sid !== null ? titles.get(String(sid)) : undefined;
      return {
        id: r.id,
        amount: r.amount,
        label: title ? `${reason} · ${title}` : reason,
        date: formatDate(r.created_at),
      };
    }),
    surveys,
    drafts: userId ? listDrafts(userId) : [],
    admin,
  };
}

// 포인트 기록의 설문 번호: "12" 또는 "12:34"(열람 수익) → 12. 개발용 기록("dev-…")·웰컴은 null
function surveyIdOf(refId: string | null): number | null {
  const match = /^(\d+)(:\d+)?$/.exec(refId ?? "");
  return match ? Number(match[1]) : null;
}

export default function My() {
  const [data, setData] = useState<MyData | null>(null);
  const [tab, setTab] = useState<Tab>("surveys");
  // 내 설문: 진행 중 / 마감 (2026-11-10, 쌓인 설문 정리)
  const [surveyFilter, setSurveyFilter] = useState<"open" | "closed">("open");

  // 탭에 돌아올 때마다 새로 불러온다 (응답 후 내역이 바로 보이게)
  useFocusEffect(
    useCallback(() => {
      fetchMy().then(setData);
    }, []),
  );

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

  // 단체는 포인트·열람이 없어서 탭 전환 없이 내 설문만. 열람한 결과는 "내 데이터" 탭(응답한·스크랩·열람한)으로 (2026-11-09)
  const tabs: { value: Tab; label: string }[] = data.isOrg
    ? []
    : [
        { value: "surveys", label: "내 설문" },
        { value: "ledger", label: "포인트 내역" },
        { value: "data", label: "내 데이터" },
      ];
  const current: Tab = data.isOrg ? "surveys" : tab;

  const openCount = data.surveys.filter((s) => !s.closed && !s.moderated).length;
  const totalResponses = data.surveys.reduce((sum, s) => sum + s.responseCount, 0);
  // 검토 중인 설문은 마감 전이면 진행 중 칸에 둔다
  const openSurveys = data.surveys.filter((s) => !s.closed);
  const closedSurveys = data.surveys.filter((s) => s.closed);
  const shownSurveys = surveyFilter === "open" ? openSurveys : closedSurveys;

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
    >
      {/* 운영자 계정에만: 처리 대기 건수 → 운영자 화면 */}
      {data.admin && (
        <Card onPress={() => router.push(ADMIN_HREF)} style={styles.adminCard}>
          <Text style={styles.adminTitle}>🛠 운영 · 처리 대기 {totalPending(data.admin)}건</Text>
          <Text style={styles.muted}>
            신고 {data.admin.reports} · 의견 {data.admin.feedback} · 단체 승인 {data.admin.orgs}
          </Text>
        </Card>
      )}

      {/* 프로필 · 포인트 · 바로가기 · 탭 (2026-11-10 디자인 정리: 피그마 C안 + A안 + 기존 포인트 카드) */}
      <View style={styles.section}>
        {/* 이름을 누르면 내 정보 (회원정보·비밀번호 변경·로그아웃) */}
        <Pressable onPress={() => router.push(ACCOUNT_HREF)} style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{data.name.slice(0, 1) || "옛"}</Text>
          </View>
          <View style={styles.profileMain}>
            <Text style={styles.name}>{data.name ? `${data.name}님` : "내 정보"}</Text>
            <Text style={styles.muted}>내 정보 · 계정 설정</Text>
            {data.needsDemographics && <Text style={styles.warn}>⚠️ 성별·출생연도를 입력해 주세요</Text>}
          </View>
          <AppIcon name={myIcons.forward} size={20} color={colors.textSubtle} />
        </Pressable>

        {/* 내 포인트 (단체는 포인트를 쓰지 않음) */}
        {!data.isOrg && (
          <View style={styles.pointCard}>
            <View style={styles.pointRing} />
            <Text style={styles.pointLabel}>내 포인트</Text>
            <Text style={styles.pointValue}>{formatPoints(data.balance)}</Text>
            <Pressable onPress={() => router.push("/points")} hitSlop={8}>
              <Text style={styles.pointLink}>포인트는 어떻게 모으고 쓰나요? ›</Text>
            </Pressable>
          </View>
        )}

        {/* 바로가기 아이콘 한 줄: 의견 보내기 · 친구 초대(학생) · 내가 쓴 글 · 제휴 문의 */}
        <View style={styles.shortcuts}>
          <Shortcut
            icon={myIcons.feedback}
           
            label="의견 보내기"
            onPress={() => router.push({ pathname: "/feedback", params: { from: "마이 탭" } })}
          />
          {!data.isOrg && <Shortcut icon={myIcons.invite} label="친구 초대" onPress={() => router.push("/invite")} />}
          <Shortcut icon={myIcons.posts} label="내가 쓴 글" onPress={() => router.push(MY_POSTS_HREF)} />
          <Shortcut icon={myIcons.partner} label="제휴 문의" onPress={() => router.push("/partnership")} />
        </View>

        {tabs.length > 0 ? (
          <Segmented options={tabs} value={current} onChange={setTab} />
        ) : (
          <Text style={styles.sectionTitle}>내 설문 관리</Text>
        )}

      {current === "surveys" && (
        <>
          {/* 운영 중 · 받은 응답: 연파랑 한 줄 */}
          <View style={styles.stats}>
            <View style={styles.statHalf}>
              <Text style={styles.statLabel}>운영 중</Text>
              <Text style={styles.statValue}>{openCount}개</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statHalf}>
              <Text style={styles.statLabel}>받은 응답</Text>
              <Text style={styles.statValue}>{totalResponses}명</Text>
            </View>
          </View>

          {/* 임시저장함: 이 폰에만 있고, 있을 때만 보인다 */}
          {data.drafts.length > 0 && (
            <Card style={list.card}>
              <Text style={styles.cardTitle}>임시저장한 설문</Text>
              {data.drafts.map((d) => (
                <Pressable
                  key={d.id}
                  style={styles.row}
                  onPress={() => router.push({ pathname: "/create", params: { draft: d.id } })}
                >
                  <View style={styles.rowMain}>
                    <Text style={styles.rowLabel} numberOfLines={1}>
                      {d.draft.title.trim() || "제목 없는 설문"}
                    </Text>
                    <Text style={styles.muted}>
                      {formatDate(d.savedAt)} 저장 · 문항 {d.draft.questions.length}개
                    </Text>
                  </View>
                  <Pressable onPress={() => removeDraft(d)} hitSlop={8}>
                    <Text style={styles.deleteText}>삭제</Text>
                  </Pressable>
                </Pressable>
              ))}
              <Text style={styles.muted}>임시저장은 이 폰에만 있어요.</Text>
            </Card>
          )}

          {data.surveys.length === 0 ? (
            <EmptyState title="아직 올린 설문이 없어요" message="궁금한 걸 대학생들에게 물어보세요." emoji="📣" />
          ) : (
            <>
              <TextTabs
                options={[
                  { value: "open", label: `진행 중 ${openSurveys.length}` },
                  { value: "closed", label: `마감 ${closedSurveys.length}` },
                ]}
                value={surveyFilter}
                onChange={setSurveyFilter}
                fill
              />
              {shownSurveys.length === 0 ? (
                <Text style={styles.muted}>
                  {surveyFilter === "open" ? "진행 중인 설문이 없어요." : "마감된 설문이 없어요."}
                </Text>
              ) : (
                shownSurveys.map((s) => <MySurveyCard key={s.id} survey={s} />)
              )}
            </>
          )}

          <Button title="+ 새 설문 등록" variant="soft" onPress={() => router.push("/create")} />
        </>
      )}

      {current === "ledger" &&
        (data.ledger.length === 0 ? (
          <EmptyState title="아직 포인트 내역이 없어요" message="설문에 답하면 여기에 쌓여요." emoji="🪙" />
        ) : (
          <Card style={list.card}>
            {data.ledger.map((item, i) => (
              <View key={item.id} style={[styles.row, i > 0 && styles.rowDivider]}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text style={styles.muted}>{item.date}</Text>
                </View>
                <Text style={[styles.amount, item.amount < 0 && styles.amountMinus]}>
                  {item.amount > 0 ? "+" : "-"}
                  {formatPoints(Math.abs(item.amount))}
                </Text>
              </View>
            ))}
          </Card>
        ))}

      {/* 응답한·스크랩·열람한 결과를 한 곳에 (2026-11-09) */}
      {current === "data" && <MyDataPanel />}
      </View>
    </ScrollView>
  );
}

// 바로가기 하나: 회색 둥근 네모 안 파란 아이콘 + 아래 이름
function Shortcut({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}>
      <View style={styles.shortcutIcon}>
        <AppIcon name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={styles.shortcutLabel}>{label}</Text>
    </Pressable>
  );
}

// 내가 올린 설문 한 개: 상태 뱃지 · 등록일 · 제목 · 응답 진행률 · 결과 공개 · [결과 보기]
function MySurveyCard({ survey: s }: { survey: MySurvey }) {
  const pct = s.target > 0 ? Math.min(100, Math.round((s.responseCount / s.target) * 100)) : 0;
  // 설문·데이터 탭 카드와 같은 파스텔 표시 (진행 중 = 연두, 마감 = 회색, 검토 중 = 빨강)
  const status = s.moderated
    ? { label: "검토 중", tone: "danger" as const }
    : s.closed
      ? { label: "마감", tone: "muted" as const }
      : { label: "진행 중", tone: "lime" as const };

  return (
    <Card onPress={() => router.push({ pathname: "/survey/[id]", params: { id: String(s.id) } })} style={list.card}>
      <View style={list.head}>
        <View style={list.top}>
          <Badge label={status.label} tone={status.tone} />
          <Text style={list.sub}>등록 {formatShortDate(s.createdAt)}</Text>
        </View>
        <Text style={list.title} numberOfLines={2}>
          {s.title}
        </Text>
      </View>

      <View style={styles.progress}>
        <View style={list.top}>
          <Text style={list.sub}>응답 진행률</Text>
          <Text style={styles.progressNum}>
            {s.responseCount} / {s.target}명 · {pct}%
          </Text>
        </View>
        <ProgressBar value={pct / 100} height={6} />
      </View>

      {/* 데이터 탭에 공개된 결과: 남들이 얼마나 봤는지 + 데이터 탭 화면으로 (결과 보기는 계속 등록자 화면) */}
      {s.hubViews !== null && (
        <Pressable
          style={styles.hubRow}
          onPress={() => router.push({ pathname: "/data/[id]", params: { id: String(s.id) } })}
          hitSlop={6}
        >
          <Text style={styles.hubText}>📊 데이터 탭 공개 중 · 열람 {s.hubViews}회</Text>
          <Text style={styles.hubLink}>데이터 탭에서 보기 ›</Text>
        </Pressable>
      )}

      {/* 아래: 결과 공개 범위 · 오른쪽 파란 알약 (목록 카드의 포인트 알약과 같은 모양) */}
      <View style={styles.cardBottom}>
        <Text style={list.sub}>결과 공개 · {VISIBILITY_LABELS[s.visibility]}</Text>
        <Pressable
          style={({ pressed }) => [list.pill, pressed && styles.pressed]}
          onPress={() => router.push({ pathname: "/survey/results", params: { id: String(s.id) } })}
          hitSlop={6}
        >
          <Text style={list.pillText}>결과 보기</Text>
        </Pressable>
      </View>
    </Card>
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
    paddingBottom: spacing.xl,
  },
  section: {
    padding: spacing.md,
    gap: spacing.md,
  },
  adminCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  adminTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.primary,
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.primary,
  },
  profileMain: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.text,
  },
  warn: {
    marginTop: spacing.xs,
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.primary,
  },
  muted: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  pointCard: {
    padding: spacing.lg,
    gap: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    overflow: "hidden",
  },
  pointRing: {
    position: "absolute",
    right: -40,
    bottom: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 24,
    borderColor: colors.onPrimarySoft,
  },
  pointLabel: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.onPrimary,
    opacity: 0.9,
  },
  pointValue: {
    fontSize: fontSize.hero,
    fontWeight: "800",
    color: colors.onPrimary,
  },
  pointLink: {
    marginTop: spacing.xs,
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.accent,
  },
  shortcuts: {
    flexDirection: "row",
    paddingVertical: spacing.xs,
  },
  shortcut: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  shortcutIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  shortcutLabel: {
    fontSize: fontSize.caption,
    fontWeight: "500",
    color: colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
  sectionTitle: {
    fontSize: fontSize.subtitle,
    fontWeight: "700",
    color: colors.text,
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  statHalf: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  statLabel: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
  },
  statDivider: {
    width: 1,
    height: 14,
    backgroundColor: colors.primaryMuted,
  },
  cardTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  amount: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.primary,
  },
  amountMinus: {
    color: colors.danger,
  },
  deleteText: {
    fontSize: fontSize.small,
    color: colors.danger,
  },
  progress: {
    gap: spacing.sm,
  },
  progressNum: {
    fontSize: fontSize.caption,
    fontWeight: "600",
    color: colors.cardTitle,
  },
  hubRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  hubText: {
    flexShrink: 1,
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.text,
  },
  hubLink: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.primary,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
});
