// 알림 허용 시트 (2026-11-14 온보딩 시안 ⑪): 첫 설문 응답 완료 화면 위에 한 번
// 연파랑 상자 안 종 아이콘 · "내일 오늘의 질문, 알려 드릴까요?" · 이런 때만 알려 드려요 · [알림 받기] → 그다음에 폰 허락 창 / 나중에
// 지금 실제로 보내는 알림만 적는다 (오늘의 질문 · 웰컴 미션). "내 설문 응답이 다 모였을 때"는 아직 없어서 뺐다
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import BottomSheet from "@/components/ui/BottomSheet";
import Button from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { guideIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { formatPoints } from "@/lib/format";
import { enablePush } from "@/lib/push";
import { fetchRules } from "@/lib/rules";

export default function NotifySheet({ onClose }: { onClose: () => void }) {
  const [daily, setDaily] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    fetchRules(["daily_reward"]).then((r) => setDaily(r.daily_reward ?? null));
  }, []);

  const allow = async () => {
    setAsking(true);
    // 우리 시트에서 "알림 받기"를 누른 뒤에만 폰 허락 창을 띄운다
    await enablePush();
    setAsking(false);
    onClose();
  };

  return (
    <BottomSheet onClose={onClose} closeLabel="나중에">
      <View style={styles.icon}>
        <AppIcon name={guideIcons.bell} size={26} color={colors.primary} />
      </View>
      <Text style={styles.title}>내일 오늘의 질문, 알려 드릴까요?</Text>
      <Text style={styles.lead}>이런 때만 알려 드려요</Text>
      <Text style={styles.item}>· 오늘의 질문이 나왔을 때{daily !== null ? ` (하루 ${formatPoints(daily)})` : ""}</Text>
      <Text style={styles.item}>· 웰컴 미션 할 시간</Text>
      <Button title="알림 받기" onPress={allow} loading={asking} style={styles.button} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 56,
    height: 56,
    marginTop: spacing.md,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryFaint,
  },
  title: {
    marginTop: spacing.md,
    fontSize: 21,
    lineHeight: 29,
    fontWeight: "800",
    color: colors.text,
  },
  lead: {
    marginTop: 6,
    fontSize: fontSize.label,
    color: colors.iconStrong,
  },
  item: {
    fontSize: fontSize.label,
    lineHeight: 22,
    color: colors.iconStrong,
  },
  button: {
    marginTop: 20,
    borderRadius: radius.lg,
  },
});
