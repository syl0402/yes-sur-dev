// ys-157 포인트 안내 · F-702 (모으는 법·쓰는 법·규칙. 숫자는 모두 point_rules에서)
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, shadow, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { fetchRules } from "@/lib/rules";

const RULE_KEYS = [
  "welcome",
  "reward_1q",
  "reward_lt5",
  "reward_5to15",
  "reward_gte15",
  "price_1q",
  "price_lt5",
  "price_5to15",
  "price_gte15",
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
    {
      label: "설문 응답",
      value: `${p("reward_1q")} ~ ${p("reward_gte15")}`,
      note: `1문항 ${p("reward_1q")} · 5분 미만 ${p("reward_lt5")} · 5~15분 ${p("reward_5to15")} · 15분 이상 ${p("reward_gte15")}`,
    },
    {
      label: "오늘의 질문",
      value: `하루 ${p("daily_reward")}`,
      note: `${r.streak_days ?? "-"}일 연속으로 답하면 +${p("streak_bonus")}`,
    },
    {
      label: "커뮤니티 투표",
      value: `1번 ${p("community_vote")}`,
      note: `커뮤니티 활동은 하루 최대 ${p("community_daily_cap")} · 내 투표에 ${r.creator_bonus_every ?? "-"}명이 참여할 때마다 +${p("creator_bonus")}`,
    },
    {
      label: "내 결과를 누가 열람",
      value: `1회 ${r.cost_data_view !== undefined && r.data_share_rate !== undefined ? formatPoints(Math.floor(r.cost_data_view * r.data_share_rate)) : "-"}`,
      note: "결과를 공개한 내 설문을 다른 사람이 열람하면",
    },
    {
      label: "친구 초대",
      value: `나 ${p("invite_reward_inviter")}`,
      note: `친구가 가입 후 내 코드를 입력하면 친구도 ${p("invite_reward_invitee")}`,
    },
    { label: "가입 축하", value: p("welcome") },
  ];

  const spend: Row[] = [
    {
      label: "설문 등록",
      value: `응답 1명당 ${p("price_1q")} ~ ${p("price_gte15")}`,
      note: `등록비 = 1명당 가격 × 목표 인원 (1문항 ${p("price_1q")} · 5분 미만 ${p("price_lt5")} · 5~15분 ${p("price_5to15")} · 15분 이상 ${p("price_gte15")}). 일찍 마감하면 못 받은 인원만큼 돌려받아요`,
    },
    {
      label: "결과 열람",
      value: p("cost_data_view"),
      note: "첫 열람 1회 · 1문항 설문 · 옛썰 공식 설문은 무료",
    },
  ];

  const rules = [
    "포인트는 옛썰 안에서만 써요. 현금·기프티콘으로 바꿀 수 없어요.",
    "확인 문항을 틀리거나 너무 빨리 응답하면 포인트를 받지 못해요. 다시 응답할 수 있어요.",
    "탈퇴하면 남은 포인트는 사라져요.",
    "금액은 운영 상황에 따라 바뀔 수 있어요. 이 화면은 늘 지금 기준이에요.",
  ];

  return (
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "포인트 안내" }} />

      <Section title="💰 모으기" rows={earn} />
      <Section title="🛒 쓰기" rows={spend} />

      <View style={styles.box}>
        <Text style={styles.boxTitle}>📌 알아 둘 것</Text>
        {rules.map((t) => (
          <Text key={t} style={styles.rule}>
            · {t}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <View style={styles.box}>
      <Text style={styles.boxTitle}>{title}</Text>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <View style={styles.rowHead}>
            <Text style={styles.label}>{row.label}</Text>
            <Text style={styles.value}>{row.value}</Text>
          </View>
          {row.note ? <Text style={styles.note}>{row.note}</Text> : null}
        </View>
      ))}
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
    padding: spacing.lg,
    gap: spacing.md,
  },
  box: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.sm,
    ...shadow.card,
  },
  boxTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  row: {
    gap: 2,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  value: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.primary,
  },
  note: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  rule: {
    fontSize: fontSize.small,
    color: colors.text,
  },
});
