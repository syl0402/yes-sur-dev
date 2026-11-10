// 앱(APK) 버전마다 들어 있는 기능이 달라서, 원격 업데이트로 새 코드가 옛 앱에 가도 멈추지 않게 확인한다 (2026-11-10)
import * as Updates from "expo-updates";
import { Platform } from "react-native";

// 도넛 등 그림(react-native-svg)은 앱 1.0.1부터 들어 있다. 1.0.0 APK에서는 그리지 않는다
// 웹 · 개발(Expo Go, runtimeVersion 없음)에서는 늘 그릴 수 있다
export const canDrawSvg = Platform.OS === "web" || Updates.runtimeVersion !== "1.0.0";
