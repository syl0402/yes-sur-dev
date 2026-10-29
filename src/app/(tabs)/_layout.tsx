import { Tabs } from "expo-router";

import AppIcon from "@/components/AppIcon";
import { tabIcons } from "@/constants/icons";
import { colors } from "@/constants/theme";

// 로그인 후 하단 탭 5개 (2026-10-29 결정: 홈·설문·밸런스·데이터·마이)
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "홈",
          headerTitle: "옛썰",
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
        name="balance"
        options={{
          title: "밸런스",
          tabBarIcon: ({ color, size }) => <AppIcon name={tabIcons.balance} color={color} size={size} />,
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
