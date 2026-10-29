import { Stack } from "expo-router";

import { colors } from "@/constants/theme";
import { useResumeSignup } from "@/hooks/useResumeSignup";

export default function RootLayout() {
  // 인증만 하고 가입을 마치지 않은 사람은 가입을 이어서 하게 한다
  useResumeSignup();

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
      }}
    >
      {/* 하단 탭은 각 탭이 제목줄을 가지므로 바깥 제목줄은 숨긴다 */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
