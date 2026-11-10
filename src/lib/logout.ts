// 로그아웃 (확인 창 → 이 기기 알림 끄기 → 로그아웃 → 첫 화면). 내 정보 화면과 ☰ 메뉴에서 같이 쓴다
import { router } from "expo-router";

import { showConfirm } from "@/lib/confirm";
import { disablePushOnThisDevice } from "@/lib/push";
import { supabase } from "@/lib/supabase";

export function confirmLogout() {
  showConfirm({
    title: "로그아웃할까요?",
    message: "",
    okLabel: "로그아웃",
    cancelLabel: "취소",
    onOk: async () => {
      // 이 기기로 내 알림이 계속 오지 않게
      await disablePushOnThisDevice();
      await supabase.auth.signOut();
      // 위에 쌓인 화면이 있을 때만 닫기 (홈 ☰ 메뉴에서는 닫을 게 없어서 경고가 뜸)
      if (router.canDismiss()) router.dismissAll();
      router.replace("/");
    },
  });
}
