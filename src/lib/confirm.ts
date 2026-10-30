import { Alert, Platform } from "react-native";

type ConfirmOptions = {
  title: string;
  message: string;
  // 진행 버튼 글자 (예: "제출", "나가기")
  okLabel: string;
  // 취소 버튼 글자 (예: "계속하기")
  cancelLabel: string;
  onOk: () => void;
  // 취소 버튼을 눌렀을 때 할 일 (없으면 창만 닫는다)
  onCancel?: () => void;
  // true면 진행 버튼을 빨간색으로 (나가기·삭제처럼 되돌릴 수 없는 일)
  destructive?: boolean;
};

// 버튼 두 개짜리 확인 창. 진행을 누를 때만 onOk가 실행된다.
// 웹 미리보기에서는 Alert 버튼이 동작하지 않아 브라우저 확인 창을 쓴다
export function showConfirm({ title, message, okLabel, cancelLabel, onOk, onCancel, destructive }: ConfirmOptions) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n${message}`)) onOk();
    else onCancel?.();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: "cancel", onPress: onCancel },
    { text: okLabel, style: destructive ? "destructive" : "default", onPress: onOk },
  ]);
}

type ChoiceOptions = {
  title: string;
  message: string;
  // 가장 권하는 선택 (예: "임시저장하고 나가기")
  primary: { label: string; onPress: () => void };
  // 되돌릴 수 없는 선택, 빨간색 (예: "저장하지 않고 나가기")
  destructive: { label: string; onPress: () => void };
  // 창만 닫는 버튼 글자 (예: "계속 작성")
  cancelLabel: string;
};

type Action = { label: string; onPress: () => void; destructive?: boolean };

// 더보기(⋯) 메뉴: 할 일 여러 개 + 닫기. 웹 미리보기는 하나씩 브라우저 확인 창으로 묻는다
export function showActions(title: string, actions: Action[]) {
  if (Platform.OS === "web") {
    const picked = actions.find((a) => window.confirm(`${title}\n\n${a.label}?`));
    picked?.onPress();
    return;
  }
  Alert.alert(title, undefined, [
    ...actions.map((a) => ({ text: a.label, style: a.destructive ? ("destructive" as const) : ("default" as const), onPress: a.onPress })),
    { text: "닫기", style: "cancel" as const },
  ]);
}

// 버튼 세 개짜리 선택 창 (권하는 것 · 되돌릴 수 없는 것 · 취소).
// 웹 미리보기는 브라우저 확인 창을 두 번 띄워 대신한다
export function showChoice({ title, message, primary, destructive, cancelLabel }: ChoiceOptions) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n${message}\n\n[확인] ${primary.label}`)) primary.onPress();
    else if (window.confirm(`${destructive.label}?`)) destructive.onPress();
    return;
  }
  Alert.alert(title, message, [
    { text: primary.label, onPress: primary.onPress },
    { text: destructive.label, style: "destructive", onPress: destructive.onPress },
    { text: cancelLabel, style: "cancel" },
  ]);
}
