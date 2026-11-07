import { router } from "expo-router";

import { showConfirm } from "@/lib/confirm";
import { supabase } from "@/lib/supabase";

// 가입 중간(인증 이후)에 그만두기: 확인 → 로그아웃 → 첫 화면.
// 같은 메일로 다시 인증하면 이어서 가입할 수 있다.
export function confirmLeaveSignup() {
  const leave = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  showConfirm({
    title: "가입을 그만둘까요?",
    message: "입력한 내용은 저장되지 않아요.",
    okLabel: "나가기",
    cancelLabel: "계속 가입하기",
    destructive: true,
    onOk: leave,
  });
}
