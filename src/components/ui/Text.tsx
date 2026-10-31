// 앱 글꼴(Pretendard)을 입힌 Text·TextInput. 화면에서는 react-native 대신 여기서 가져온다 (2026-10-31)
import {
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
} from "react-native";

import { colors, fontFamily } from "@/constants/theme";

export function Text({ style, ...rest }: TextProps) {
  return <RNText style={[{ fontFamily }, style]} {...rest} />;
}

// ref도 그대로 넘어간다 (TextInputProps에 들어 있음)
export function TextInput({ style, ...rest }: TextInputProps) {
  return (
    <RNTextInput
      style={[{ fontFamily, backgroundColor: colors.surface }, style]}
      placeholderTextColor={colors.textSubtle}
      {...rest}
    />
  );
}
