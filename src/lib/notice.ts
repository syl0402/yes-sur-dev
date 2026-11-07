import { Alert } from "react-native";

import { openAppDialog, USE_APP_DIALOG } from "@/lib/appDialog";

// 확인 버튼 하나짜리 안내 창. 닫힌 뒤 할 일이 있으면 onClose로 넘긴다.
// 웹·안드로이드는 앱 안 창(AppDialog), 아이폰은 기본 창
export function showNotice(title: string, message: string, onClose?: () => void) {
  if (USE_APP_DIALOG) {
    openAppDialog({ title, message, layout: "row", buttons: [{ label: "확인", style: "primary", onPress: onClose }] });
    return;
  }
  Alert.alert(title, message, [{ text: "확인", onPress: onClose }]);
}
