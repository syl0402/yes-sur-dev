// 앱 안 창 (웹·안드로이드): 확인 창·⋯ 메뉴·알림. 앱 맨 바깥(_layout)에 한 번만 둔다 (2026-11-07)
// 아이폰에서는 아무것도 그리지 않는다 (기본 창 사용)
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, shadow, spacing } from "@/constants/theme";
import { closeAppDialog, subscribeAppDialog, USE_APP_DIALOG, type AppDialogButton, type AppDialogState } from "@/lib/appDialog";

export default function AppDialog() {
  const [dialog, setDialog] = useState<AppDialogState | null>(null);

  useEffect(() => (USE_APP_DIALOG ? subscribeAppDialog(setDialog) : undefined), []);

  if (!USE_APP_DIALOG || !dialog) return null;

  // 바깥을 누르면 취소 버튼과 같게 (버튼이 하나뿐인 알림 창은 그 버튼과 같게)
  const cancel = dialog.buttons.find((b) => b.style === "cancel") ?? (dialog.buttons.length === 1 ? dialog.buttons[0] : undefined);
  const press = (b?: AppDialogButton) => {
    closeAppDialog();
    b?.onPress?.();
  };

  return (
    <Modal transparent statusBarTranslucent animationType="fade" visible onRequestClose={() => press(cancel)}>
      <Pressable style={styles.overlay} onPress={() => press(cancel)}>
        {/* 창 안을 눌러도 닫히지 않게 */}
        <Pressable style={styles.box} onPress={() => undefined}>
          <Text style={styles.title}>{dialog.title}</Text>
          {!!dialog.message && <Text style={styles.message}>{dialog.message}</Text>}
          <View style={dialog.layout === "row" ? styles.row : styles.column}>
            {dialog.buttons.map((b) => (
              <Pressable
                key={b.label}
                onPress={() => press(b)}
                style={({ pressed }) => [
                  styles.button,
                  dialog.layout === "row" && styles.rowButton,
                  b.style === "primary" && styles.primary,
                  b.style === "destructive" && dialog.layout === "row" && styles.danger,
                  b.style === "cancel" && styles.cancel,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.label,
                    b.style === "primary" && styles.onFill,
                    b.style === "destructive" && (dialog.layout === "row" ? styles.onFill : styles.dangerText),
                    b.style === "cancel" && styles.cancelText,
                  ]}
                >
                  {b.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: colors.overlay,
  },
  box: {
    width: "100%",
    maxWidth: 360,
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  title: {
    fontSize: fontSize.subtitle,
    fontWeight: "700",
    color: colors.text,
  },
  message: {
    fontSize: fontSize.body,
    lineHeight: 22,
    color: colors.textMuted,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  column: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  button: {
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  rowButton: {
    flex: 1,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  cancel: {
    backgroundColor: colors.surfaceMuted,
  },
  pressed: {
    opacity: 0.8,
  },
  label: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.text,
  },
  onFill: {
    color: colors.surface,
  },
  dangerText: {
    color: colors.danger,
  },
  cancelText: {
    color: colors.textMuted,
  },
});
