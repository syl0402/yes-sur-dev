import { type Href, Tabs, router } from "expo-router";
import { Pressable } from "react-native";

import AppIcon from "@/components/AppIcon";
import Logo from "@/components/ui/Logo";
import { tabIcons, uiIcons } from "@/constants/icons";
import { colors, fontFamily } from "@/constants/theme";

// 통합 검색 (search.tsx). 개발 서버가 경로 목록을 늦게 갱신해 타입 오류가 나는 일이 있어 Href로 고정
const SEARCH_HREF = "/search" as Href;

// 로그인 후 하단 탭 5개 (홈·설문·커뮤니티·데이터·마이. 2026-10-30 밸런스 → 커뮤니티)
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily, fontWeight: "600" },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text, fontFamily, fontWeight: "700" },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "홈",
          headerTitle: () => <Logo />,
          headerTitleAlign: "left",
          // 오른쪽 위 돋보기 → 통합 검색 (설문 · 데이터 · 커뮤니티, 2026-11-10)
          headerRight: () => (
            <Pressable onPress={() => router.push(SEARCH_HREF)} hitSlop={10} style={{ paddingHorizontal: 16 }} accessibilityLabel="검색">
              <AppIcon name={uiIcons.search} size={24} color={colors.text} />
            </Pressable>
          ),
          tabBarIcon: ({ color, size }) => <AppIcon name={tabIcons.home} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="surveys"
        options={{
          title: "설문",
          tabBarIcon: ({ color, size }) => <AppIcon name={tabIcons.surveys} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: "커뮤니티",
          tabBarIcon: ({ color, size }) => <AppIcon name={tabIcons.community} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="data"
        options={{
          title: "데이터",
          tabBarIcon: ({ color, size }) => <AppIcon name={tabIcons.data} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="my"
        options={{
          title: "마이",
          tabBarIcon: ({ color, size }) => <AppIcon name={tabIcons.my} color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
