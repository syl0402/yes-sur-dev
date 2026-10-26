import { Alert, Platform } from "react-native";

// 확인 버튼 하나짜리 안내 창. 닫힌 뒤 할 일이 있으면 onClose로 넘긴다.
// 웹 미리보기에서는 Alert가 동작하지 않아 브라우저 알림 창을 쓴다
export function showNotice(title: string, message: string, onClose?: () => void) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n${message}`);
    onClose?.();
    return;
  }
  Alert.alert(title, message, [{ text: "확인", onPress: onClose }]);
}
