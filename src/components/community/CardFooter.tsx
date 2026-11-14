// 커뮤니티 카드 아랫줄 (2026-11-14 디자인 피드백: 12px 연회색은 잘 안 보여서)
// 위에 1px 구분선 → [사람 아이콘] n명 참여 · [말풍선 아이콘] 댓글 n · 오른쪽 끝에 작은 설명(선택)
// 숫자도 같은 굵기 (2026-11-14 피드백: 굵게 안 해도 됨)
// 설문 홍보 카드는 참여 수 없이 댓글만 (votes 없이)
import { StyleSheet, View } from "react-native";

import AppIcon from "@/components/AppIcon";
import { Text } from "@/components/ui/Text";
import { commentIcons } from "@/constants/icons";
import { colors, fontSize } from "@/constants/theme";

type Props = {
  votes?: number;
  comments: number;
  // 오른쪽 끝 작은 회색 설명 (예: 월드컵 "막대는 우승 비율")
  note?: string;
};

export default function CardFooter({ votes, comments, note }: Props) {
  return (
    <View style={styles.footer}>
      {votes !== undefined && (
        <View style={styles.item}>
          <AppIcon name={commentIcons.people} size={15} color={colors.iconStrong} />
          <Text style={styles.text}>{votes}명 참여</Text>
        </View>
      )}
      <View style={styles.item}>
        <AppIcon name={commentIcons.chat} size={15} color={colors.iconStrong} />
        <Text style={styles.text}>댓글 {comments}</Text>
      </View>
      {note ? (
        <Text style={styles.note} numberOfLines={1}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // 카드 안 간격(12) 아래에 구분선, 선 아래 10
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  text: {
    fontSize: fontSize.small,
    color: colors.textStrong,
  },
  note: {
    flex: 1,
    textAlign: "right",
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
});
