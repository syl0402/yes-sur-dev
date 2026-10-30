import { Linking, type StyleProp, StyleSheet, Text, type TextStyle } from "react-native";

import { colors } from "@/constants/theme";
import { showConfirm } from "@/lib/confirm";

// http(s) 주소만 링크로 (다른 형식은 그냥 글자)
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

type Props = {
  children: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  // 길게 눌러 복사 (목록 카드처럼 누르면 이동하는 곳에서는 끈다)
  selectable?: boolean;
};

// 사용자가 쓴 글: 주소는 파란 링크, 누르면 "옛썰 밖의 링크" 확인 후 브라우저로
export default function LinkedText({ children, style, numberOfLines, selectable }: Props) {
  const parts = children.split(URL_PATTERN);

  const open = (url: string) =>
    showConfirm({
      title: "옛썰 밖의 링크예요",
      message: `${url}\n\n옛썰이 확인하지 않은 링크예요. 개인정보나 결제를 요구하면 주의해 주세요.`,
      okLabel: "열기",
      cancelLabel: "취소",
      onOk: () => Linking.openURL(url),
    });

  return (
    <Text style={style} numberOfLines={numberOfLines} selectable={selectable}>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <Text key={i} style={styles.link} onPress={() => open(part)}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    color: colors.primary,
    textDecorationLine: "underline",
  },
});
