import "./storage";

import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase 환경 변수가 없습니다. .env에 EXPO_PUBLIC_SUPABASE_URL과 EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 넣고 개발 서버를 다시 시작하세요."
  );
}

// 아이폰에서 앱이 잠시 쉬면 서버와의 연결 통로가 끊기는데, 첫 요청이 그 통로로 나가
// "The network connection was lost"로 실패하는 일이 잦다. 연결 오류일 때만 한 번 더 보낸다.
// 같은 요청이 두 번 가도 안전하다: 가입·포인트 서버 함수는 중복 요청을 한 번만 처리한다.
const fetchWithRetry: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch (error) {
    // 연결 자체가 실패한 경우(TypeError)만. 서버가 보낸 오류 응답은 그대로 돌려준다
    if (error instanceof TypeError) return fetch(input, init);
    throw error;
  }
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchWithRetry,
  },
});

// 앱이 화면에 있을 때만 로그인 토큰을 자동 갱신한다.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
