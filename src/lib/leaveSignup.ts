import { router } from "expo-router";
import { Alert, Platform } from "react-native";

import { supabase } from "@/lib/supabase";

// 가입 중간(인증 이후)에 그만두기: 확인 → 로그아웃 → 첫 화면.
// 같은 메일로 다시 인증하면 이어서 가입할 수 있다.
export function confirmLeaveSignup() {
  const leave = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const title = "가입을 그만둘까요?";
  const message = "입력한 내용은 저장되지 않아요.";

  // 웹 미리보기에서는 Alert 버튼이 동작하지 않아 브라우저 확인 창을 쓴다
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n${message}`)) leave();
    return;
  }
  Alert.alert(title, message, [
    { text: "계속 가입하기", style: "cancel" },
    { text: "나가기", style: "destructive", onPress: leave },
  ]);
}
