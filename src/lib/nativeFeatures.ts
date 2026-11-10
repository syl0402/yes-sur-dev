// 앱(APK) 버전마다 들어 있는 기능이 달라서, 원격 업데이트로 새 코드가 옛 앱에 가도 멈추지 않게 확인한다 (2026-11-10)
import * as Updates from "expo-updates";
import { Platform } from "react-native";

// 옛 APK: 그림(react-native-svg)·알림(expo-notifications) 부품이 들어 있지 않다
const OLD_APK = Updates.runtimeVersion === "1.0.0";

// 도넛 등 그림: 앱 1.0.1부터. 웹 · 개발(Expo Go, runtimeVersion 없음)에서는 늘 그릴 수 있다
export const canDrawSvg = Platform.OS === "web" || !OLD_APK;

// 푸시 알림: 앱 1.0.1부터, 폰에서만 (웹은 받지 못함)
export const canUseNotifications = Platform.OS !== "web" && !OLD_APK;

// 진동(expo-haptics)·사진 고르기(expo-image-picker): 앱 1.0.1부터 들어 있다. 쓸 때 이 값으로 먼저 확인할 것
// (1주차: 응답 선택 진동 · 문항 사진. 2026-11-10 설치만 미리)
export const canVibrate = Platform.OS !== "web" && !OLD_APK;
export const canPickImage = Platform.OS === "web" || !OLD_APK;
