// 아래에서 올라오는 창 (2026-11-12 공용으로 묶음: 미션 상세 · 응답 완료 보상 연락처 · 등록 답변 방식 고르기 등)
// 어두운 바탕이 스르르(250ms) + 창이 아래에서 올라온다(400ms). 바탕을 누르거나 안드로이드 뒤로 가기면 닫힘
// decoration: 창 위에 걸터앉는 그림 (예: 미션 학사모 캐릭터) · closeLabel: 맨 아래 "나중에 할게요" 같은 닫기 글자
// keyboard: 안에 입력칸이 있으면 true (키보드가 올라오면 창도 같이 올라간다)
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { colors, radius, spacing } from "@/constants/theme";

type Props = {
  onClose: () => void;
  children: ReactNode;
  decoration?: ReactNode;
  closeLabel?: string;
  keyboard?: boolean;
};

export default function BottomSheet({ onClose, children, decoration, closeLabel, keyboard }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(250)} style={styles.dim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
      </Animated.View>
      <KeyboardAvoidingView
        enabled={keyboard === true}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.wrap}
        pointerEvents="box-none"
      >
        <Animated.View
          entering={SlideInDown.duration(400).easing(Easing.bezier(0.2, 0.8, 0.2, 1))}
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}
        >
          {decoration}
          <View style={styles.handle} />
          {children}
          {closeLabel ? (
            <Pressable onPress={onClose} style={styles.later}>
              <Text style={styles.laterText}>{closeLabel}</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  wrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "90%",
    paddingTop: 12,
    paddingHorizontal: spacing.lg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: colors.surface,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
  },
  later: {
    marginTop: 6,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  laterText: {
    fontSize: 15,
    color: colors.iconStrong,
  },
});
