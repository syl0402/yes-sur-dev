// 앱 전체 푸시 알림 준비 (루트 레이아웃에서 한 번, 2026-11-10)
// - 앱이 켜질 때 · 로그인할 때: 이미 알림을 허락했으면 이 기기 알림 주소를 내 것으로 다시 등록
// - 알림을 누르면 그 알림의 화면으로 (예: 오늘의 질문)
import { type Href, router } from "expo-router";
import { useEffect } from "react";

import { initPush, listenPushTaps } from "@/lib/push";
import { supabase } from "@/lib/supabase";

export function usePush() {
  useEffect(() => {
    initPush();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") initPush();
    });
    let stop = () => {};
    listenPushTaps((url) => router.push(url as Href)).then((fn) => {
      stop = fn;
    });
    return () => {
      data.subscription.unsubscribe();
      stop();
    };
  }, []);
}
