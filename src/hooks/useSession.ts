import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

// 지금 로그인 상태. 로그인·로그아웃하면 바로 바뀐다.
// undefined = 아직 확인 중, null = 로그아웃 상태
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // 앱 시작 시 저장된 로그인도 여기로 들어온다.
    // 이 안에서는 다른 Supabase 호출을 하지 않는다 (Supabase 안내)
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return session;
}
