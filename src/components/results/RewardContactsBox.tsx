// 내 설문 결과(작성자만): 🎁 보상 연락처 N명 → 번호 보기 · 전체 복사 · 모두 지우기 (2026-11-07)
// 번호만 무작위 순서로 받는다 (누가 어떤 답을 했는지 연결되지 않게). CSV·데이터 탭에는 들어가지 않는다
import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import RewardNotice from "@/components/RewardNotice";
import Button from "@/components/ui/Button";
import AppIcon from "@/components/AppIcon";
import { Text } from "@/components/ui/Text";
import { uiIcons } from "@/constants/icons";
import { colors, fontSize, radius, shadow, spacing } from "@/constants/theme";
import { showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

// 01012345678 → 010-1234-5678
function formatPhone(p: string): string {
  return p.length === 11 ? `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}` : `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`;
}

export default function RewardContactsBox({ surveyId, note }: { surveyId: number; note: string }) {
  // null = 불러오는 중
  const [phones, setPhones] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    supabase.rpc("get_reward_contacts", { p_survey_id: surveyId }).then(({ data, error }) => {
      if (error) {
        showNotice("연락처를 불러오지 못했어요", errorMessage(error));
        setPhones([]);
        return;
      }
      setPhones((data as string[] | null) ?? []);
    });
  }, [surveyId]);

  useEffect(load, [load]);

  const copyAll = async () => {
    if (!phones || phones.length === 0) return;
    try {
      await Clipboard.setStringAsync(phones.map(formatPhone).join("\n"));
      showNotice("번호를 복사했어요", "보상 지급에만 쓰고, 지급이 끝나면 지워 주세요.");
    } catch {
      showNotice("복사하지 못했어요", "잠시 후 다시 시도해 주세요.");
    }
  };

  const clearAll = () =>
    showConfirm({
      title: "연락처를 모두 지울까요?",
      message: "지운 번호는 되돌릴 수 없어요. 보상 지급이 끝났을 때 지워 주세요.",
      okLabel: "모두 지우기",
      cancelLabel: "취소",
      destructive: true,
      onOk: async () => {
        const { error } = await supabase.rpc("clear_reward_contacts", { p_survey_id: surveyId });
        if (error) {
          showNotice("지우지 못했어요", errorMessage(error));
          return;
        }
        setOpen(false);
        load();
      },
    });

  return (
    <View style={styles.box}>
      <View style={styles.titleRow}>
        <AppIcon name={uiIcons.gift} size={16} color={colors.primary} />
        <Text style={styles.title}>보상 연락처 {phones === null ? "…" : `${phones.length}명`}</Text>
      </View>
      <RewardNotice note={note} />
      <Text style={styles.warn}>
        보상 지급에만 쓰고, 지급이 끝나면 꼭 지워 주세요. 번호는 남긴 날부터 일정 기간 뒤 자동으로 지워져요.
      </Text>

      {phones !== null && phones.length > 0 && (
        <>
          <Pressable onPress={() => setOpen(!open)} hitSlop={8}>
            <Text style={styles.toggle}>{open ? "번호 숨기기 ▴" : "번호 보기 ▾"}</Text>
          </Pressable>
          {open && (
            <View style={styles.list}>
              {phones.map((p) => (
                <Text key={p} style={styles.phone} selectable>
                  {formatPhone(p)}
                </Text>
              ))}
            </View>
          )}
          <View style={styles.actions}>
            <Button title="전체 복사" variant="outline" small onPress={copyAll} style={styles.action} />
            <Button title="모두 지우기" variant="outline" small onPress={clearAll} style={styles.action} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  title: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  warn: {
    fontSize: fontSize.small,
    color: colors.danger,
  },
  toggle: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.primary,
  },
  list: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  phone: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
});
