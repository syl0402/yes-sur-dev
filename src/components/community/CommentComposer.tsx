// 화면 맨 아래 고정 댓글 입력칸 (2026-11-14 커뮤니티 시안): [익명 ✓] [댓글을 남겨 주세요] [↑]
// "답글 달기"를 누르면 위에 "○○에게 답글" 줄이 생기고 입력칸에 바로 커서가 간다 (✕로 그만)
// 키보드가 올라오면 그만큼 같이 올라간다. 아이폰 홈 막대·안드로이드 제스처 영역만큼 띄운다
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppIcon from "@/components/AppIcon";
import { Text, TextInput, type TextInputRef } from "@/components/ui/Text";
import { commentIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import type { CommentThread } from "@/hooks/useCommentThread";
import { COMMENT_MAX } from "@/lib/community";

const SEND_SIZE = 44;

export default function CommentComposer({ thread }: { thread: CommentThread }) {
  const { send, sending, anonymous, setAnonymous, canAnon, replyTo, setReplyTo } = thread;
  const [text, setText] = useState("");
  const input = useRef<TextInputRef>(null);
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const bottomGap = Math.max(insets.bottom, spacing.sm);

  // 답글 대상을 고르면 입력칸에 바로 커서
  useEffect(() => {
    if (replyTo) input.current?.focus();
  }, [replyTo]);

  // 키보드가 있으면 키보드 높이만큼, 없으면 홈 막대만큼 아래 여백
  const lift = useAnimatedStyle(() => ({
    paddingBottom: keyboard.height.value > 0 ? keyboard.height.value + spacing.sm : bottomGap,
  }));

  const canSend = text.trim().length > 0 && !sending;
  const submit = async () => {
    if (!canSend) return;
    if (await send(text)) {
      setText("");
      input.current?.blur();
    }
  };

  return (
    <Animated.View style={[styles.bar, lift]}>
      {replyTo && (
        <View style={styles.replyLine}>
          <Text style={styles.replyText} numberOfLines={1}>
            <Text style={styles.replyName}>{replyTo.author}</Text>에게 답글 남기는 중
          </Text>
          <Pressable onPress={() => setReplyTo(null)} hitSlop={10} accessibilityLabel="답글 그만 쓰기">
            <AppIcon name={commentIcons.close} size={16} color={colors.iconStrong} />
          </Pressable>
        </View>
      )}
      <View style={styles.row}>
        {canAnon && (
          <Pressable
            onPress={() => setAnonymous(!anonymous)}
            style={[styles.anon, anonymous && styles.anonOn]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: anonymous }}
          >
            <Text style={[styles.anonText, anonymous && styles.anonTextOn]}>{anonymous ? "익명 ✓" : "익명"}</Text>
          </Pressable>
        )}
        <TextInput
          ref={input}
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={replyTo ? "답글을 남겨 주세요" : "댓글을 남겨 주세요"}
          placeholderTextColor={colors.textSubtle}
          maxLength={COMMENT_MAX}
          multiline
          accessibilityLabel="댓글 입력"
        />
        <Pressable
          onPress={submit}
          disabled={!canSend}
          style={[styles.send, !canSend && styles.sendOff]}
          accessibilityLabel="등록"
        >
          <AppIcon name={commentIcons.send} size={20} color={colors.onPrimary} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: spacing.sm,
    paddingTop: 10,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  replyLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
  },
  replyText: {
    flex: 1,
    fontSize: fontSize.small,
    color: colors.iconStrong,
  },
  replyName: {
    fontWeight: "700",
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  anon: {
    height: 40,
    marginBottom: 2,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  anonOn: {
    backgroundColor: colors.primarySoft,
  },
  anonText: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.iconStrong,
  },
  anonTextOn: {
    color: colors.primaryStrong,
  },
  input: {
    flex: 1,
    minHeight: SEND_SIZE,
    maxHeight: 110,
    paddingHorizontal: spacing.md,
    paddingTop: 11,
    paddingBottom: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    fontSize: 15,
    color: colors.text,
  },
  send: {
    width: SEND_SIZE,
    height: SEND_SIZE,
    borderRadius: SEND_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  sendOff: {
    backgroundColor: colors.disabled,
  },
});
