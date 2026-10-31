import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import { colors, fontFamily } from "@/constants/theme";
import { useResumeSignup } from "@/hooks/useResumeSignup";

// 글꼴을 다 불러올 때까지 시작 화면을 유지한다 (기본 글꼴로 잠깐 보였다 바뀌지 않게)
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // 인증만 하고 가입을 마치지 않은 사람은 가입을 이어서 하게 한다
  useResumeSignup();

  // 앱 글꼴 Pretendard: 한 이름 아래 굵기 4종 → 화면에서는 fontWeight로 고른다
  const [fontsLoaded, fontError] = useFonts([
    {
      fontFamily,
      fontDefinitions: [
        { path: require("../../assets/fonts/Pretendard-Regular.otf"), weight: 400 },
        { path: require("../../assets/fonts/Pretendard-SemiBold.otf"), weight: 600 },
        { path: require("../../assets/fonts/Pretendard-Bold.otf"), weight: 700 },
        { path: require("../../assets/fonts/Pretendard-ExtraBold.otf"), weight: 800 },
      ],
    },
  ]);
  // 글꼴을 못 불러와도 기본 글꼴로 앱은 연다
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text, fontFamily, fontWeight: "700" },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        // 뒤로 버튼은 화살표만 (이전 화면 이름이 "(tabs)" 같은 폴더 이름으로 나오지 않게)
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      {/* 하단 탭은 각 탭이 제목줄을 가지므로 바깥 제목줄은 숨긴다 */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
