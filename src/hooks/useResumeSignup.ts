import type { Session } from "@supabase/supabase-js";
import { router, useSegments } from "expo-router";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

// 인증번호까지만 하고 앱을 끈 사람(로그인됨 + 회원정보 없음)을
// 가입 유형 선택 화면으로 보내 가입을 이어서 끝내게 한다.
// 승인 전 단체 계정은 승인 대기 화면으로 보낸다. 앱 맨 바깥(_layout)에서 한 번 부른다.
export function useResumeSignup() {
  const segments = useSegments();
  const [session, setSession] = useState<Session | null>(null);

  // 로그인 상태 저장 (앱 시작 시 저장된 로그인도 여기로 들어온다)
  // 이 안에서는 다른 Supabase 호출을 하지 않는다 (Supabase 안내)
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  // 가입 화면 안에서는 정상 흐름(인증 → 회원정보)을 방해하지 않는다
  const inSignup = segments[0] === "signup";

  useEffect(() => {
    if (!userId || inSignup) return;

    let cancelled = false;
    supabase
      .from("profiles")
      .select("account_type, approval_status")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) return;
        if (!data) {
          // 인증만 하고 가입을 마치지 않음 → 유형 선택부터 이어서
          router.replace({ pathname: "/signup/type", params: { resume: "1" } });
          return;
        }
        if (data.account_type === "org" && data.approval_status !== "approved") {
          // 승인 전 단체 계정은 승인 대기 화면만 볼 수 있다
          router.replace("/signup/pending");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId, inSignup]);
}
