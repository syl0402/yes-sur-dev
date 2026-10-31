import { Tabs } from "expo-router";

import AppIcon from "@/components/AppIcon";
import Logo from "@/components/ui/Logo";
import { tabIcons } from "@/constants/icons";
import { colors, fontFamily } from "@/constants/theme";

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
