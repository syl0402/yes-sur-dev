// ys-150 마이 홈 · F-701 (2026-10-31 디자인, 2026-11-14 마이 탭 시안 ①)
// 프로필 → 포인트 카드(기존 그대로) → 친구 초대 배너 → [내 설문 | 내 데이터 | 커뮤니티] → 요약 숫자 → 최근 목록 + 전체 보기 → 도움
// 단체는 포인트·데이터·커뮤니티 없이 내 설문만
import { type Href, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

import AppIcon from "@/components/AppIcon";
import MySurveyCard from "@/components/my/MySurveyCard";
import TabTip from "@/components/onboarding/TabTip";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ListRow from "@/components/ui/ListRow";
import Segmented from "@/components/ui/Segmented";
import { Text } from "@/components/ui/Text";
import { myIcons, uiIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { type AdminCounts, fetchAdminCounts, totalPending } from "@/lib/admin";
import { KIND_LABELS } from "@/lib/community";
import { showConfirm } from "@/lib/confirm";
import { formatDate, formatPoints, formatShortDate } from "@/lib/format";
import { type DataRow, type DataTab, fetchMyCommunity, fetchMyDataRows, type MyCommunity } from "@/lib/myActivity";
import { fetchMySurveys, type MySurvey } from "@/lib/mySurveys";
import { fetchRules } from "@/lib/rules";
import { supabase } from "@/lib/supabase";
import { type SavedDraft, deleteDraft, listDrafts } from "@/lib/surveyDraft";

// 개발 서버가 경로 목록을 늦게 갱신해 타입 오류가 나는 일이 있어 Href로 고정
const ACCOUNT_HREF = "/account" as Href;
const ADMIN_HREF = "/admin" as Href;
const MY_POSTS_HREF = "/my-posts" as Href;
const MY_SURVEYS_HREF = "/my-surveys" as Href;
const MY_DATA_HREF = "/my-data" as Href;
const POINTS_HISTORY_HREF = "/points-history" as Href;

// 마이 홈에서 보여 줄 개수 (전체는 "전체 보기")
const PREVIEW_SURVEYS = 2;
const PREVIEW_ROWS = 3;

type Tab = "surveys" | "data" | "community";

type MyData = {
  userId: string;
  isOrg: boolean;
  // 학생인데 성별·출생연도가 비어 있음 (기능 추가 전 가입) → 한 번만 입력
  needsDemographics: boolean;
  name: string;
  // "중앙대학교 · 사회 계열" (단체는 "단체 계정")
  sub: string;
  balance: number;
  surveys: MySurvey[];
  // 이 폰에 임시저장한 설문 (서버에는 없음)
  drafts: SavedDraft[];
  // 운영자 계정이면 처리 대기 건수, 아니면 null
  admin: AdminCounts | null;
  // 친구 초대 보상 (point_rules)
  invite: { inviter: number; invitee: number } | null;
  // 운영자가 답한 내 의견 수
  answered: number;
};

function first<T>(raw: unknown): T | null {
  return ((Array.isArray(raw) ? raw[0] : raw) as T | null) ?? null;
}

// 내 정보·잔액·내 설문·임시저장 (모두 본인 것만 읽힌다)
async function fetchMy(): Promise<MyData> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? "";

  const [{ data: profile }, { data: org }, { data: balance }, surveys, admin, rules, feedback] = await Promise.all([
    supabase
      .from("profiles")
      .select("nickname, account_type, gender, birth_year, universities(name), major_fields(category_name)")
      .maybeSingle(),
    supabase.from("organizations").select("name").maybeSingle(),
    supabase.rpc("get_my_balance"),
    fetchMySurveys(userId),
    fetchAdminCounts(),
    fetchRules(["invite_reward_inviter", "invite_reward_invitee"]),
    supabase.from("feedback").select("id", { count: "exact", head: true }).neq("status", "pending"),
  ]);

  const isOrg = profile?.account_type === "org";
  const school = first<{ name: string }>(profile?.universities)?.name ?? "";
  const major = first<{ category_name: string }>(profile?.major_fields)?.category_name ?? "";

  return {
    userId,
    isOrg,
    needsDemographics: !isOrg && (profile?.gender == null || profile?.birth_year == null),
    name: org?.name ?? profile?.nickname ?? "",
    sub: isOrg ? "단체 계정" : [school, major && `${major} 계열`].filter(Boolean).join(" · ") || "내 정보 · 계정 설정",
    balance: typeof balance === "number" ? balance : 0,
    surveys,
    drafts: userId ? listDrafts(userId) : [],
    admin,
    invite:
      rules.invite_reward_inviter !== undefined && rules.invite_reward_invitee !== undefined
        ? { inviter: rules.invite_reward_inviter, invitee: rules.invite_reward_invitee }
        : null,
    answered: feedback.count ?? 0,
  };
}

// 최근 목록 한 줄 (내 데이터 · 커뮤니티)
type Row = { key: string; title: string; sub: string; at: string; onPress?: () => void };

// 최근 본 데이터: 열람 → 응답 → 스크랩 순으로 모아 겹치는 설문은 하나만
function recentData(rows: Record<DataTab, DataRow[]>): Row[] {
  const label: Record<DataTab, string> = { viewed: "열람함", answered: "응답함", saved: "스크랩" };
  const seen = new Set<number>();
  const out: Row[] = [];
  for (const tab of ["viewed", "answered", "saved"] as DataTab[]) {
    for (const r of rows[tab]) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({
        key: `${tab}-${r.id}`,
        title: r.title,
        sub: `${label[tab]} · ${r.sub}`,
        at: r.at,
        onPress: () => router.push({ pathname: "/data/[id]", params: { id: String(r.id) } }),
      });
    }
  }
  return out.slice(0, PREVIEW_ROWS);
}

// 최근 활동: 내 글 · 참여 · 내 댓글을 시간순으로
function recentCommunity(c: MyCommunity): Row[] {
  const openPost = (id: number) => () => router.push({ pathname: "/community/[id]", params: { id: String(id) } });
  const openCup = (id: number) => () => router.push({ pathname: "/community/worldcup/[id]", params: { id: String(id) } });
  const rows: Row[] = [
    ...c.posts
      .filter((p) => p.moderation === "visible")
      .map((p) => ({
        key: `p-${p.id}`,
        title: p.question,
        sub: `내 ${KIND_LABELS[p.kind]} · ${p.votes}명 참여 · 댓글 ${p.comment_count}`,
        at: p.created_at,
        onPress: openPost(p.id),
      })),
    ...c.votes.map((v) => ({
      key: `v-${v.type}-${v.id}`,
      title: v.title,
      sub: `참여${v.choice ? ` · ${v.choice}` : ""}`,
      at: v.created_at,
      onPress: v.type === "post" ? openPost(v.id) : v.type === "worldcup" ? openCup(v.id) : undefined,
    })),
    ...c.comments
      .filter((m) => m.moderation === "visible")
      .map((m) => ({
        key: `c-${m.id}`,
        title: `“${m.body}”`,
        sub: `내 댓글 · ${m.target_title ?? ""} · ${formatShortDate(m.created_at)}`,
        at: m.created_at,
        onPress:
          m.target_type === "post"
            ? openPost(m.target_id)
            : m.target_type === "worldcup"
              ? openCup(m.target_id)
              : m.today
                ? () => router.push("/community/daily")
                : undefined,
      })),
  ];
  return rows.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, PREVIEW_ROWS);
}

export default function My() {
  const [data, setData] = useState<MyData | null>(null);
  const [dataRows, setDataRows] = useState<Record<DataTab, DataRow[]> | null>(null);
  const [community, setCommunity] = useState<MyCommunity | null>(null);
  const [tab, setTab] = useState<Tab>("surveys");

  // 탭에 돌아올 때마다 새로 불러온다 (응답 후 숫자가 바로 바뀌게)
  useFocusEffect(
    useCallback(() => {
      fetchMy().then((d) => {
        setData(d);
        if (d.isOrg) return;
        fetchMyDataRows().then(setDataRows);
        fetchMyCommunity().then(setCommunity);
      });
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

  const current: Tab = data.isOrg ? "surveys" : tab;
  const openSurveys = data.surveys.filter((s) => !s.closed);
  const openCount = data.surveys.filter((s) => !s.closed && !s.moderated).length;
  const totalResponses = data.surveys.reduce((sum, s) => sum + s.responseCount, 0);

  // 탭마다: 요약 숫자 · 목록 제목 · 전체 보기
  const sums: { label: string; value: string }[] =
    current === "surveys"
      ? [
          { label: "운영 중", value: `${openCount}개` },
          { label: "받은 응답", value: `${totalResponses}명` },
        ]
      : current === "data"
        ? [
            { label: "응답", value: dataRows ? String(dataRows.answered.length) : "-" },
            { label: "스크랩", value: dataRows ? String(dataRows.saved.length) : "-" },
            { label: "열람", value: dataRows ? String(dataRows.viewed.length) : "-" },
          ]
        : [
            { label: "글", value: community ? String(community.posts.length) : "-" },
            { label: "댓글", value: community ? String(community.comments.length) : "-" },
            { label: "참여", value: community ? String(community.votes.length) : "-" },
          ];
  const listTitle = current === "surveys" ? "진행 중인 설문" : current === "data" ? "최근 본 데이터" : "최근 활동";
  const moreHref = current === "surveys" ? MY_SURVEYS_HREF : current === "data" ? MY_DATA_HREF : MY_POSTS_HREF;

  const rows =
    current === "data" ? (dataRows ? recentData(dataRows) : null) : current === "community" ? (community ? recentCommunity(community) : null) : null;

  return (
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
      {/* 처음 열 때 한 번 말풍선 (2026-11-14 온보딩 시안 ⑩) */}
      <TabTip tab="my" />

      {/* 운영자 계정에만: 처리 대기 건수 → 운영자 화면 */}
      {data.admin && (
        <Card onPress={() => router.push(ADMIN_HREF)} style={styles.adminCard}>
          <View style={styles.iconLine}>
            <AppIcon name={uiIcons.admin} size={18} color={colors.primary} />
            <Text style={styles.adminTitle}>운영 · 처리 대기 {totalPending(data.admin)}건</Text>
          </View>
          <Text style={styles.muted}>
            신고 {data.admin.reports} · 의견 {data.admin.feedback} · 단체 승인 {data.admin.orgs}
          </Text>
        </Card>
      )}

      {/* 프로필: 누르면 내 정보 */}
      <Pressable onPress={() => router.push(ACCOUNT_HREF)} style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{data.name.slice(0, 1) || "옛"}</Text>
        </View>
        <View style={styles.profileMain}>
          <Text style={styles.name}>{data.name ? `${data.name}님` : "내 정보"}</Text>
          <Text style={styles.muted}>{data.sub}</Text>
          {data.needsDemographics && (
            <View style={styles.iconLine}>
              <AppIcon name={uiIcons.alert} size={14} color={colors.primary} />
              <Text style={styles.warn}>성별·출생연도를 입력해 주세요</Text>
            </View>
          )}
        </View>
        <AppIcon name={myIcons.forward} size={20} color={colors.textSubtle} />
      </Pressable>

      {/* 내 포인트 (기존 카드 그대로, 단체는 포인트를 쓰지 않음) */}
      {!data.isOrg && (
        <View style={styles.pointCard}>
          <View style={styles.pointRing} />
          {/* 오른쪽 위 "내역 보기 ›" → 포인트 내역 (2026-11-14 시안) */}
          <View style={styles.pointHead}>
            <Text style={styles.pointLabel}>내 포인트</Text>
            <Pressable onPress={() => router.push(POINTS_HISTORY_HREF)} hitSlop={10}>
              <Text style={styles.pointHistory}>내역 보기 ›</Text>
            </Pressable>
          </View>
          <Text style={styles.pointValue}>{formatPoints(data.balance)}</Text>
          <Pressable onPress={() => router.push("/points")} hitSlop={8}>
            <Text style={styles.pointLink}>포인트는 어떻게 모으고 쓰나요? ›</Text>
          </Pressable>
        </View>
      )}

      {/* 친구 초대 배너 (보상은 point_rules) */}
      {!data.isOrg && data.invite && (
        <Pressable onPress={() => router.push("/invite")} style={({ pressed }) => [styles.invite, pressed && styles.pressed]}>
          <AppIcon name={myIcons.invite} size={20} color={colors.onAccentSoft} />
          <Text style={styles.inviteText}>
            <Text style={styles.inviteStrong}>친구 초대하면 {formatPoints(data.invite.inviter)}</Text>
            <Text style={styles.inviteSub}> · 친구도 {formatPoints(data.invite.invitee)}</Text>
          </Text>
          <AppIcon name={myIcons.forward} size={18} color={colors.onAccentSoft} />
        </Pressable>
      )}

      {/* 카테고리 탭 (단체는 내 설문만) */}
      {data.isOrg ? (
        <Text style={styles.sectionTitle}>내 설문 관리</Text>
      ) : (
        <Segmented
          options={[
            { value: "surveys", label: "내 설문" },
            { value: "data", label: "내 데이터" },
            { value: "community", label: "커뮤니티" },
          ]}
          value={current}
          onChange={setTab}
        />
      )}

      {/* 탭을 바꾸면 아래 내용이 살짝 올라오며 나타남 */}
      <Animated.View key={current} entering={FadeInUp.duration(300)} style={styles.tabBody}>
        {/* 요약 숫자 한 줄 (칸 사이 세로선) */}
        <View style={styles.sums}>
          {sums.map((m, i) => (
            <View key={m.label} style={[styles.sum, i > 0 && styles.sumLine]}>
              <Text style={styles.sumLabel}>{m.label}</Text>
              <Text style={styles.sumValue}>{m.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.listHead}>
          <Text style={styles.listTitle}>{listTitle}</Text>
          <Pressable onPress={() => router.push(moreHref)} hitSlop={8}>
            <Text style={styles.more}>전체 보기 ›</Text>
          </Pressable>
        </View>

        {current === "surveys" && (
          <>
            {/* 임시저장함: 이 폰에만 있고, 있을 때만 보인다 */}
            {data.drafts.length > 0 && (
              <Card>
                <Text style={styles.cardTitle}>임시저장한 설문</Text>
                <View>
                  {data.drafts.map((d, i) => (
                    <ListRow
                      key={d.id}
                      first={i === 0}
                      title={d.draft.title.trim() || "제목 없는 설문"}
                      sub={`${formatDate(d.savedAt)} 저장 · 문항 ${d.draft.questions.length}개`}
                      onPress={() => router.push({ pathname: "/create", params: { draft: d.id } })}
                      right={
                        <Pressable onPress={() => removeDraft(d)} hitSlop={8}>
                          <Text style={styles.deleteText}>삭제</Text>
                        </Pressable>
                      }
                    />
                  ))}
                </View>
                <Text style={styles.muted}>임시저장은 이 폰에만 있어요.</Text>
              </Card>
            )}
            {openSurveys.length === 0 ? (
              <Text style={styles.empty}>
                {data.surveys.length === 0 ? "아직 올린 설문이 없어요. 궁금한 걸 대학생들에게 물어보세요." : "진행 중인 설문이 없어요."}
              </Text>
            ) : (
              openSurveys.slice(0, PREVIEW_SURVEYS).map((s) => <MySurveyCard key={s.id} survey={s} />)
            )}
            <Button title="+ 새 설문 등록" variant="soft" onPress={() => router.push("/create")} />
          </>
        )}

        {current !== "surveys" &&
          (rows === null ? (
            <ActivityIndicator color={colors.primary} />
          ) : rows.length === 0 ? (
            <Text style={styles.empty}>
              {current === "data" ? "아직 본 데이터가 없어요. 데이터 탭에서 다른 설문 결과를 볼 수 있어요." : "아직 커뮤니티 활동이 없어요."}
            </Text>
          ) : (
            <Card>
              <View>
                {rows.map((r, i) => (
                  <ListRow key={r.key} first={i === 0} title={r.title} sub={r.sub} onPress={r.onPress} />
                ))}
              </View>
            </Card>
          ))}
      </Animated.View>

      {/* 도움 */}
      <View style={styles.help}>
        <Text style={styles.helpTitle}>도움</Text>
        <Card>
          <View>
            <ListRow
              first
              icon={myIcons.feedback}
              title="의견 보내기"
              value={data.answered > 0 ? `답변 ${data.answered}` : undefined}
              valueTone="primary"
              onPress={() => router.push({ pathname: "/feedback", params: { from: "마이 탭" } })}
            />
            {!data.isOrg && (
              <ListRow
                icon={myIcons.guide}
                title="사용 안내 다시 보기"
                onPress={() => router.push({ pathname: "/onboarding", params: { again: "1" } })}
              />
            )}
          </View>
        </Card>
        <Text style={styles.partner}>
          기업·학생회라면{" "}
          <Text style={styles.partnerLink} onPress={() => router.push("/partnership")}>
            제휴·광고 문의
          </Text>
        </Text>
      </View>
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
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
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
  // 포인트 카드: 기존 그대로 (2026-11-14 사용자 요청)
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
  pointHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pointHistory: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.primarySoft,
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
  // 친구 초대 배너 (연연두)
  invite: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 56,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
  },
  inviteText: {
    flex: 1,
    fontSize: fontSize.label,
    color: colors.text,
  },
  inviteStrong: {
    fontWeight: "700",
  },
  inviteSub: {
    color: colors.onAccentSoft,
  },
  pressed: {
    opacity: 0.7,
  },
  sectionTitle: {
    fontSize: fontSize.subtitle,
    fontWeight: "700",
    color: colors.text,
  },
  tabBody: {
    gap: spacing.md,
  },
  // 요약 숫자: 바탕 없이, 칸 사이 회색 세로선
  sums: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
  },
  sum: {
    flex: 1,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 6,
  },
  sumLine: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  sumLabel: {
    fontSize: fontSize.label,
    color: colors.iconStrong,
  },
  sumValue: {
    fontSize: fontSize.subtitle,
    fontWeight: "700",
    color: colors.text,
  },
  listHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listTitle: {
    fontSize: fontSize.body,
    fontWeight: "800",
    color: colors.text,
  },
  more: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.iconStrong,
  },
  empty: {
    paddingVertical: spacing.md,
    fontSize: fontSize.small,
    color: colors.textMuted,
    textAlign: "center",
  },
  cardTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  deleteText: {
    fontSize: fontSize.small,
    color: colors.danger,
  },
  iconLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  help: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  helpTitle: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.iconStrong,
  },
  partner: {
    marginTop: spacing.xs,
    fontSize: fontSize.small,
    color: colors.iconStrong,
  },
  partnerLink: {
    fontWeight: "700",
    color: colors.text,
  },
});
