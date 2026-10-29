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
