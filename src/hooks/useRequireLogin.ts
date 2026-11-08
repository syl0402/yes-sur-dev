import { router, useRootNavigationState, useSegments } from "expo-router";
import { useEffect } from "react";

import { useSession } from "@/hooks/useSession";

// 로그인 없이 볼 수 있는 화면: 첫 화면 · 로그인 · 가입 · 비밀번호 찾기
const PUBLIC_SEGMENTS = new Set(["login", "signup", "reset"]);

// 로그인 안 된 상태로 다른 화면에 들어오면 첫 화면으로 보낸다 (2026-11-09 팀 피드백).
// 웹에서 /home 같은 주소를 바로 열거나, 앱에서 로그인이 풀렸을 때 빈 화면("0P · 설문 없음")이 보이지 않게.
// 앱 맨 바깥(_layout)에서 한 번 부른다
export function useRequireLogin() {
  const segments = useSegments();
  const session = useSession();
  // 화면 이동 준비가 끝났는지 (글꼴을 불러오는 동안엔 아직 화면이 없다)
  const navReady = !!useRootNavigationState()?.key;

  const first = segments[0] as string | undefined;
  const isPublic = first === undefined || PUBLIC_SEGMENTS.has(first);

  useEffect(() => {
    // session undefined = 아직 확인 중
    if (navReady && session === null && !isPublic) router.replace("/");
  }, [navReady, session, isPublic]);
}
