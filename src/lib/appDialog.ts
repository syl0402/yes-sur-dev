// 앱 안 창: 확인 창·⋯ 메뉴·알림 (2026-11-07 피드백). 창 모양은 components/ui/AppDialog.tsx
// - 웹: 브라우저 확인 창이 메뉴를 하나씩 물어봐서 헷갈림
// - 안드로이드: 기본 창이 빈 공간이 크고 메뉴를 목록으로 못 그림
// 아이폰은 기본 창(Alert)이 깔끔해서 그대로 쓴다
import { Platform } from "react-native";

export const USE_APP_DIALOG = Platform.OS !== "ios";

export type AppDialogButton = {
  label: string;
  onPress?: () => void;
  // cancel = 회색(닫기), destructive = 빨강(삭제·나가기), primary = 파랑(권하는 것)
  style?: "default" | "cancel" | "destructive" | "primary";
};

export type AppDialogState = {
  title: string;
  message?: string;
  buttons: AppDialogButton[];
  // row = 버튼 가로 두 개 (확인 창), column = 세로 목록 (⋯ 메뉴·세 가지 선택)
  layout: "row" | "column";
};

let current: AppDialogState | null = null;
const listeners = new Set<(d: AppDialogState | null) => void>();

export function openAppDialog(dialog: AppDialogState) {
  current = dialog;
  listeners.forEach((l) => l(current));
}

export function closeAppDialog() {
  current = null;
  listeners.forEach((l) => l(current));
}

// AppDialog 화면 조각이 창이 열리고 닫히는 것을 듣는다
export function subscribeAppDialog(listener: (d: AppDialogState | null) => void) {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}
