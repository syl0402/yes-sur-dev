// ys-123 설문 등록 완료 · F-405 (2026-11-14 설문 흐름 시안 register/Done)
// 캐릭터 점프 · "설문을 올렸어요!" · n명이 모이면 자동 마감 · 커뮤니티 설문 홍보 바로 가기 · 홈으로 / 내 설문 보기
// 시안의 링크 복사·공유하기는 테스트 후 검토 (로그인 없이 웹에서 열리는지 확인 필요) → 지금 있는 커뮤니티 "설문 홍보"로 대신
import { Image } from "expo-image";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInUp, ZoomIn } from "react-native-reanimated";

import AppIcon from "@/components/AppIcon";
import BottomBar from "@/components/ui/BottomBar";
import Button from "@/components/ui/Button";
import Hop from "@/components/ui/Hop";
import { Text } from "@/components/ui/Text";
import { homeIcons, uiIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

const GRAD = require("../../../assets/images/characters/study.png");

export default function SurveyCreated() {
  // id: 올린 설문 · target: 목표 인원 · warn: 태그·보상 안내 저장 실패 안내 (작성 화면이 넘겨줌)
  const { id, target, warn } = useLocalSearchParams<{ id: string; target?: string; warn?: string }>();

  // 쌓인 화면을 닫고 탭으로
  const goHome = () => {
    router.dismissAll();
    router.navigate("/home");
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "등록 완료", headerBackVisible: false, gestureEnabled: false }} />

      <ScrollView contentContainerStyle={styles.body}>
        {/* 캐릭터: 연파랑 동그라미가 톡 커지고 한 번 콩 뛴다 */}
        <View style={styles.hero}>
          <Animated.View entering={ZoomIn.duration(450)} style={styles.circle} />
          <Hop>
            <Image source={GRAD} style={styles.character} contentFit="contain" accessibilityLabel="옛썰 캐릭터" />
          </Hop>
        </View>
        <Animated.View entering={FadeInUp.delay(300).duration(450)} style={styles.center}>
          <Text style={styles.title}>설문을 올렸어요!</Text>
          <Text style={styles.message}>
            {target ? `${target}명이 모이면 자동으로 마감돼요.` : "목표 인원이 모이면 자동으로 마감돼요."}
            {"\n"}응답이 모이면 마이 탭 ‘내가 올린 설문’에서 볼 수 있어요.
          </Text>
          {warn ? <Text style={styles.warn}>{warn}</Text> : null}
        </Animated.View>

        {/* 더 빨리 모으기: 커뮤니티 설문 홍보 글쓰기 (이 설문을 골라 둔 채 열림) */}
        <Animated.View entering={FadeInUp.delay(500).duration(450)} style={styles.stretch}>
          <Pressable
            style={({ pressed }) => [styles.promo, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: "/community/new", params: { promo: id } })}
          >
            <View style={styles.promoIcon}>
              <AppIcon name={homeIcons.community} size={22} color={colors.onAccentSoft} />
            </View>
            <View style={styles.promoMain}>
              <Text style={styles.promoTitle}>커뮤니티에 홍보하면 더 빨리 모여요</Text>
              <Text style={styles.promoSub}>‘설문 홍보’ 글을 올려 보세요</Text>
            </View>
            <AppIcon name={uiIcons.chevron} size={18} color={colors.onAccentSoft} />
          </Pressable>
        </Animated.View>
      </ScrollView>

      <BottomBar>
        <Button title="홈으로" variant="outline" onPress={goHome} style={styles.side} />
        <Button
          title="내 설문 보기"
          onPress={() => router.replace({ pathname: "/survey/[id]", params: { id: String(id) } })}
          style={styles.main}
        />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    alignItems: "center",
    paddingTop: 56,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  center: {
    alignItems: "center",
  },
  stretch: {
    alignSelf: "stretch",
  },
  hero: {
    width: 168,
    height: 150,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  circle: {
    position: "absolute",
    top: 0,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primarySoft,
  },
  character: {
    width: 150,
    height: 136,
  },
  title: {
    marginTop: spacing.lg,
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  message: {
    marginTop: spacing.sm,
    fontSize: 15,
    lineHeight: 23,
    color: colors.iconStrong,
    textAlign: "center",
  },
  warn: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.danger,
    textAlign: "center",
  },
  promo: {
    marginTop: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 18,
    borderRadius: radius.xl,
    backgroundColor: colors.accentSoft,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  promoIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  promoMain: {
    flex: 1,
    gap: 3,
  },
  promoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  promoSub: {
    fontSize: fontSize.small,
    color: colors.textStrong,
  },
  side: {
    width: 104,
  },
  main: {
    flex: 1,
  },
});
