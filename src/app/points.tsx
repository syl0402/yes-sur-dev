// ys-157 포인트 안내 · F-702 (모으는 법·쓰는 법·규칙. 숫자는 모두 point_rules에서)
// 2026-11-09 정리: 설문 길이별 숫자(응답 보상·등록비)를 표 하나로 모으고, 모으기·쓰기 목록은 짧게
// 2026-11-10: 카드·목록 줄을 앱 공통 모양(Card · ListRow)으로
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import Card from "@/components/ui/Card";
import ListRow, { rowsCard } from "@/components/ui/ListRow";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { BAND_RULE_KEYS, BANDS } from "@/lib/pointBands";
import { fetchRules } from "@/lib/rules";

const RULE_KEYS = [
  "welcome",
  ...BAND_RULE_KEYS,
  "daily_reward",
  "streak_days",
  "streak_bonus",
  "community_vote",
  "community_daily_cap",
  "creator_bonus_every",
  "creator_bonus",
  "cost_data_view",
  "data_share_rate",
  "invite_reward_inviter",
  "invite_reward_invitee",
  "sec_per_choice",
  "sec_per_text",
];

type Row = { label: string; value: string; note?: string };

export default function PointsGuide() {
  const [r, setR] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    fetchRules(RULE_KEYS).then(setR);
  }, []);

  if (r === null) {
    return <ActivityIndicator color={colors.primary} style={styles.loading} />;
  }

  const p = (key: string) => (r[key] !== undefined ? formatPoints(r[key]) : "-");

  const earn: Row[] = [
    { label: "설문 응답", value: `${p("reward_1q")} ~ ${p("reward_gte15")}`, note: "설문 길이에 따라 (위 표)" },
    {
      label: "오늘의 질문",
      value: `하루 ${p("daily_reward")}`,
      note: `${r.streak_days ?? "-"}일 연속으로 답하면 +${p("streak_bonus")}`,
    },
    {
      label: "커뮤니티 투표 · 월드컵",
      value: `1번에 ${p("community_vote")}`,
      note: `하루 ${p("community_daily_cap")}까지 · 월드컵은 처음 한 판만`,
    },
    {
      label: "내 투표 인기 보너스",
      value: p("creator_bonus"),
      note: `내가 만든 투표에 ${r.creator_bonus_every ?? "-"}명이 참여할 때마다`,
    },
    {
      label: "결과 열람 수익",
      value: `1번에 ${r.cost_data_view !== undefined && r.data_share_rate !== undefined ? formatPoints(Math.floor(r.cost_data_view * r.data_share_rate)) : "-"}`,
      note: "결과를 공개한 내 설문을 다른 사람이 열람할 때마다",
    },
    {
      label: "친구 초대",
      value: p("invite_reward_inviter"),
      note: `친구가 가입하고 내 코드를 입력하면 (친구도 ${p("invite_reward_invitee")})`,
    },
    { label: "가입 축하", value: p("welcome") },
  ];

  const spend: Row[] = [
    {
      label: "설문 등록",
      value: `1명당 ${p("price_1q")} ~ ${p("price_gte15")}`,
      note: "1명당 등록비(위 표) × 목표 인원 · 일찍 마감하면 못 받은 인원만큼 돌려받아요",
    },
    {
      label: "결과 열람",
      value: p("cost_data_view"),
      note: "첫 열람 1회 · 1문항 설문 · 옛썰 공식 설문은 무료",
    },
  ];

  const rules = [
    "포인트는 옛썰 안에서만 써요. 현금·기프티콘으로 바꿀 수 없어요.",
    "확인 문항을 틀리면 포인트를 받지 못해요. 다시 응답할 수 있어요.",
    "탈퇴하면 남은 포인트는 사라져요.",
    "금액은 운영 상황에 따라 바뀔 수 있어요. 이 화면은 늘 지금 기준이에요.",
  ];

  return (
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "포인트 안내" }} />

      {/* 핵심 한 줄: 등록비는 응답 보상의 절반 → 같은 길이 설문에 2번 응답하면 내 설문 응답 1명 */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>응답 2번 = 내 설문 응답 1명</Text>
        <Text style={styles.heroText}>같은 길이의 설문이면, 등록비(1명당)는 응답 보상의 절반이에요.</Text>
      </View>

      {/* 설문 길이별 숫자를 한 표에 (2026-11-10: 이모지 소제목 → 작은 회색 소제목, 표는 연회색 상자) */}
      <View style={styles.group}>
        <Text style={styles.groupTitle}>설문 길이별 포인트</Text>
        <View style={styles.tableBox}>
          <View style={styles.tr}>
            <Text style={[styles.th, styles.colLen]}>설문 길이</Text>
            <Text style={[styles.th, styles.colNum]}>응답하면</Text>
            <Text style={[styles.th, styles.colNum]}>등록 1명당</Text>
          </View>
          {BANDS.map((b) => (
            <View key={b.key} style={styles.tr}>
              <Text style={[styles.td, styles.colLen]}>{b.label}</Text>
              <Text style={[styles.tdEarn, styles.colNum]}>+{p(`reward_${b.key}`)}</Text>
              <Text style={[styles.tdSpend, styles.colNum]}>{p(`price_${b.key}`)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.note}>
          설문 길이는 문항으로 계산한 예상 시간이에요 (고르는 문항 {r.sec_per_choice ?? "-"}초 · 주관식 {r.sec_per_text ?? "-"}초).
        </Text>
      </View>

      <Section title="모으기" rows={earn} />
      <Section title="쓰기" rows={spend} />

      <View style={styles.group}>
        <Text style={styles.groupTitle}>알아 둘 것</Text>
        <View style={styles.rulesBox}>
          {rules.map((t) => (
            <View key={t} style={styles.ruleRow}>
              <Text style={styles.ruleDot}>·</Text>
              <Text style={styles.rule}>{t}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <Card style={rowsCard}>
        {rows.map((row, i) => (
          <ListRow key={row.label} first={i === 0} title={row.label} sub={row.note} value={row.value} valueTone="primary" />
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 20,
    paddingBottom: spacing.xl,
    gap: 28,
  },
  hero: {
    padding: 18,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
    gap: 4,
  },
  heroTitle: {
    fontSize: fontSize.subtitle,
    fontWeight: "800",
    color: colors.primary,
  },
  heroText: {
    fontSize: fontSize.small,
    lineHeight: 19,
    color: colors.text,
  },
  // 묶음: 작은 회색 제목 + 내용 (내 정보 화면과 같은 모양)
  group: {
    gap: spacing.sm,
  },
  groupTitle: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.textMuted,
  },
  tableBox: {
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
  },
  tr: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  th: {
    fontSize: fontSize.caption,
    fontWeight: "600",
    color: colors.textMuted,
  },
  colLen: {
    flex: 1.2,
  },
  colNum: {
    flex: 1,
    textAlign: "right",
  },
  td: {
    fontSize: 15,
    color: colors.text,
  },
  tdEarn: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
  },
  tdSpend: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  note: {
    paddingHorizontal: spacing.xs,
    fontSize: fontSize.caption,
    lineHeight: 17,
    color: colors.textSubtle,
  },
  rulesBox: {
    padding: 18,
    gap: 10,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
  },
  ruleRow: {
    flexDirection: "row",
    gap: 6,
  },
  ruleDot: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  rule: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
});
