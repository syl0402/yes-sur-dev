// 오류 자동 수집 (Sentry, 2026-11-10)
// - 테스터 폰(앱 1.0.1 이상)·웹에서 앱이 멈추거나 오류가 나면 어느 화면·코드인지 기록한다
// - 개인정보: 오류 내용·기기 종류·앱 버전만. 이름·메일·IP 등은 보내지 않음(sendDefaultPii: false), 화면 녹화(Replay) 안 씀
// - 개발 중(__DEV__)에는 보내지 않는다
import * as Sentry from "@sentry/react-native";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

// 옛 APK(1.0.0)에는 Sentry 부품이 없어 켜지 않는다 (웹은 괜찮음)
const supported = Platform.OS === "web" || Updates.runtimeVersion !== "1.0.0";

export function initSentry() {
  if (!DSN || !supported || __DEV__) return;
  Sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    // 성능 추적·프로파일링은 쓰지 않음 (오류만)
    tracesSampleRate: 0,
    // 어느 업데이트(원격 업데이트 포함)에서 난 오류인지
    dist: Updates.updateId ?? undefined,
  });
}

export const wrapWithSentry = Sentry.wrap;
