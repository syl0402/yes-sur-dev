// 앱 글꼴(Pretendard)을 입힌 Text·TextInput. 화면에서는 react-native 대신 여기서 가져온다 (2026-10-31)
import type { ComponentRef, Ref } from "react";
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

// ref를 넘기면 입력칸에 커서 보내기(focus) 등을 할 수 있다 (2026-11-14 댓글 답글)
export type TextInputRef = ComponentRef<typeof RNTextInput>;
export function TextInput({ style, ref, ...rest }: TextInputProps & { ref?: Ref<TextInputRef> }) {
  return (
    <RNTextInput
      ref={ref}
      style={[{ fontFamily, backgroundColor: colors.surface }, style]}
      placeholderTextColor={colors.textSubtle}
      {...rest}
    />
  );
}
