// 카드 안 목록 한 줄 (2026-11-10, 마이 탭에서 이어지는 화면들 통일)
// [아이콘] 이름 / 작은 설명 ……… 오른쪽 값 또는 › 화살표. 첫 줄이 아니면 위에 얇은 선
// 예: 내 정보 메뉴 · 회원정보 · 포인트 안내 · 포인트 내역 · 내 데이터 · 내가 쓴 댓글
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import { Text } from "@/components/ui/Text";
import { type IconName, myIcons } from "@/constants/icons";
import { colors, fontSize, spacing } from "@/constants/theme";

type Props = {
  title: string;
  sub?: string;
  // 오른쪽 글자 (예: "+10P", "중앙대학교"). 글자 대신 다른 것을 넣고 싶으면 right
  value?: string;
  valueTone?: "primary" | "danger" | "text";
  right?: ReactNode;
  icon?: IconName;
  // 제목 줄 수 (댓글처럼 길면 2)
  titleLines?: number;
  // 맨 위 줄이면 true (위 선을 그리지 않음)
  first?: boolean;
  // 설정 화면처럼 선 없이 · 제목 보통 굵기 (상자 없이 줄만 놓을 때)
  plain?: boolean;
  onPress?: () => void;
};

export default function ListRow({
  title,
  sub,
  value,
  valueTone = "text",
  right,
  icon,
  titleLines = 1,
  first,
  plain,
  onPress,
}: Props) {
  const body = (
    <>
      {icon && (
        <View style={styles.icon}>
          <AppIcon name={icon} size={20} color={colors.primary} />
        </View>
      )}
      <View style={styles.main}>
        <Text style={[styles.title, plain && styles.titlePlain]} numberOfLines={titleLines}>
          {title}
        </Text>
        {sub ? (
          <Text style={styles.sub} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>
      {value ? <Text style={[styles.value, styles[valueTone]]}>{value}</Text> : null}
      {right}
      {onPress && !right && <AppIcon name={myIcons.forward} size={18} color={colors.textSubtle} />}
    </>
  );
  const rowStyle = [styles.row, !first && !plain && styles.divider, plain && styles.rowPlain];
  if (!onPress) return <View style={rowStyle}>{body}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...rowStyle, pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  rowPlain: {
    paddingVertical: 12,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pressed: {
    opacity: 0.6,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  main: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  titlePlain: {
    fontWeight: "500",
  },
  sub: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  value: {
    fontSize: 15,
    fontWeight: "700",
    maxWidth: "55%",
    textAlign: "right",
  },
  primary: {
    color: colors.primary,
  },
  danger: {
    color: colors.danger,
  },
  text: {
    color: colors.text,
  },
});

// ListRow만 담는 카드에 덧붙이는 모양: 줄이 위아래 여백을 가지므로 카드 위아래 여백·줄 사이 간격을 줄인다
// 사용: <Card style={rowsCard}>
export const rowsCard = { paddingVertical: spacing.xs, gap: 0 };
