// 홈 오른쪽 위 ☰ 메뉴 (2026-11-10). 오른쪽에서 밀려 나온다.
// 나누는 기준(푸망 방식): 이 메뉴 = 앱 안 이동·서비스 안내 / 마이 탭 = 내 정보·내 기록
import { type Href, router } from "expo-router";
import { useEffect, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppIcon from "@/components/AppIcon";
import Logo from "@/components/ui/Logo";
import { Text } from "@/components/ui/Text";
import { type IconName, menuIcons } from "@/constants/icons";
import { colors, fontSize, spacing } from "@/constants/theme";
import { openLegal } from "@/lib/legal";
import { confirmLogout } from "@/lib/logout";
import { supabase } from "@/lib/supabase";

// 개발 서버가 경로 목록을 늦게 갱신해 타입 오류가 나는 일이 있어 Href로 고정
const SEARCH_HREF = "/search" as Href;

// 메뉴 폭: 화면의 80% (넓은 화면에서도 360까지)
const MAX_WIDTH = 360;

type Item = { icon: IconName; label: string; onPress: () => void };

// 제목줄 오른쪽 ☰ 버튼 (누르면 메뉴가 열린다)
export function MenuButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={10} accessibilityLabel="메뉴 열기">
        <AppIcon name={menuIcons.open} size={26} color={colors.text} />
      </Pressable>
      <SideMenu visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default function SideMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(screenWidth * 0.8, MAX_WIDTH);
  // 0 = 숨김, 1 = 다 나옴
  const [slide] = useState(() => new Animated.Value(0));
  const [name, setName] = useState("");

  // 열릴 때마다: 밀려 나오기 + 내 이름 (단체는 단체 이름)
  useEffect(() => {
    if (!visible) return;
    slide.setValue(0);
    Animated.timing(slide, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    Promise.all([
      supabase.from("profiles").select("nickname").maybeSingle(),
      supabase.from("organizations").select("name").maybeSingle(),
    ]).then(([{ data: profile }, { data: org }]) => setName(org?.name ?? profile?.nickname ?? ""));
  }, [visible, slide]);

  // 메뉴를 닫고 이동
  const go = (action: () => void) => () => {
    onClose();
    action();
  };

  const items: Item[][] = [
    [
      { icon: menuIcons.home, label: "홈", onPress: go(() => router.navigate("/home")) },
      { icon: menuIcons.search, label: "검색", onPress: go(() => router.push(SEARCH_HREF)) },
    ],
    [
      {
        icon: menuIcons.about,
        label: "옛썰 소개",
        onPress: go(() => router.push({ pathname: "/onboarding", params: { again: "1" } })),
      },
      {
        icon: menuIcons.feedback,
        label: "의견 보내기",
        onPress: go(() => router.push({ pathname: "/feedback", params: { from: "메뉴" } })),
      },
      { icon: menuIcons.partner, label: "제휴·광고 문의", onPress: go(() => router.push("/partnership")) },
    ],
    [
      { icon: menuIcons.terms, label: "이용약관", onPress: go(() => openLegal("terms")) },
      { icon: menuIcons.privacy, label: "개인정보처리방침", onPress: go(() => openLegal("privacy")) },
    ],
    [{ icon: menuIcons.logout, label: "로그아웃", onPress: go(confirmLogout) }],
  ];

  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [width, 0] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* 바깥(어두운 부분)을 누르면 닫힘 */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="메뉴 닫기" />
      <Animated.View
        style={[styles.panel, { width, paddingTop: insets.top + spacing.md, transform: [{ translateX }] }]}
      >
        <View style={styles.top}>
          <Logo />
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="메뉴 닫기">
            <AppIcon name={menuIcons.close} size={28} color={colors.text} />
          </Pressable>
        </View>
        {name !== "" && (
          <Text style={styles.name} numberOfLines={1}>
            {name}님
          </Text>
        )}

        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}>
          {items.map((group, i) => (
            <View key={i} style={[styles.group, i > 0 && styles.groupGap]}>
              {group.map((item) => (
                <Pressable
                  key={item.label}
                  onPress={item.onPress}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <AppIcon name={item.icon} size={22} color={colors.textMuted} />
                  <Text style={styles.label}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  panel: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: fontSize.subtitle,
    fontWeight: "700",
    color: colors.text,
  },
  group: {
    paddingTop: spacing.sm,
  },
  // 묶음 사이 굵은 구분 (푸망처럼)
  groupGap: {
    marginTop: spacing.sm,
    borderTopWidth: 6,
    borderTopColor: colors.surfaceMuted,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowPressed: {
    opacity: 0.5,
  },
  label: {
    fontSize: fontSize.body,
    fontWeight: "500",
    color: colors.text,
  },
});
