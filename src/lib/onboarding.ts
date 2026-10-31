// 첫 사용 안내를 봤는지 이 폰에 기억한다 (계정마다). 저장 방식은 임시저장함과 같은 localStorage
// 폰을 바꾸면 한 번 더 보일 수 있다 (서버를 고치지 않는 간단한 방법, 2026-10-31)

const key = (userId: string) => `onboarding_seen:${userId}`;

export function hasSeenOnboarding(userId: string): boolean {
  try {
    return localStorage.getItem(key(userId)) === "1";
  } catch {
    // 저장소를 못 읽으면 안내를 다시 띄우지 않는다 (매번 뜨면 더 불편)
    return true;
  }
}

export function markOnboardingSeen(userId: string) {
  try {
    localStorage.setItem(key(userId), "1");
  } catch {
    // 저장 실패는 무시 (다음에 한 번 더 보일 뿐)
  }
}
