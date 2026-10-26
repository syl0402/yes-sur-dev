// ys-001 회원가입 · F-101 약관 동의
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import { colors, fontSize, spacing } from "@/constants/theme";

// TODO(임시): 약관 본문 · 기획팀 Q11 약관 초안이 오면 교체 · docs/QUESTIONS.md Q11
const TERMS = [
  {
    key: "service",
    title: "[필수] 이용약관 동의",
    body: "옛썰 이용약관 (임시 문구). 정식 약관은 준비 중입니다.",
  },
  {
    key: "privacy",
    title: "[필수] 개인정보 수집·이용 동의",
    body:
      "수집 항목: 학교 이메일, 닉네임, 학과, 과정, 입학년도\n" +
      "이용 목적: 회원 식별, 대학생 인증, 서비스 제공\n" +
      "보관 기간: 회원 탈퇴 시까지 (임시 문구)",
  },
];

export default function SignupTerms() {
  // resume=1: 인증만 하고 가입을 마치지 않은 사람이 이어서 하는 경우 (useResumeSignup)
  const { resume } = useLocalSearchParams<{ resume?: string }>();
  const isResume = resume === "1";

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [opened, setOpened] = useState<string | null>(null);

  const allChecked = TERMS.every((t) => checked[t.key]);

  const toggleAll = () => {
    const next = !allChecked;
    setChecked(Object.fromEntries(TERMS.map((t) => [t.key, next])));
  };

  const toggle = (key: string) => {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const goNext = () => {
    if (isResume) {
      // 이미 인증된 상태라 이메일·인증번호를 건너뛰고 회원정보로
      router.replace({ pathname: "/signup/profile", params: { agreed: "1" } });
      return;
    }
    router.push({ pathname: "/signup/email", params: { agreed: "1" } });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Stack.Screen options={{ title: "회원가입" }} />

      {isResume && <Text style={styles.notice}>가입을 이어서 진행할게요.</Text>}
      <Text style={styles.heading}>약관에 동의해 주세요</Text>

      <Pressable style={[styles.row, styles.allRow]} onPress={toggleAll}>
        <CheckBox checked={allChecked} />
        <Text style={styles.allText}>전체 동의</Text>
      </Pressable>

      {TERMS.map((t) => (
        <View key={t.key}>
          <View style={styles.row}>
            <Pressable style={styles.rowMain} onPress={() => toggle(t.key)}>
              <CheckBox checked={!!checked[t.key]} />
              <Text style={styles.itemText}>{t.title}</Text>
            </Pressable>
            <Pressable onPress={() => setOpened(opened === t.key ? null : t.key)}>
              <Text style={styles.link}>{opened === t.key ? "닫기" : "보기"}</Text>
            </Pressable>
          </View>
          {opened === t.key && <Text style={styles.body}>{t.body}</Text>}
        </View>
      ))}

      <View style={styles.footer}>
        <PrimaryButton title="다음" onPress={goNext} disabled={!allChecked} />
      </View>
    </ScrollView>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.box, checked && styles.boxChecked]}>
      {checked && <Text style={styles.check}>✓</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  // 내용이 짧아도 화면 끝까지 흰 배경
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  notice: {
    fontSize: fontSize.small,
    color: colors.primary,
  },
  heading: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  allRow: {
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  allText: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  itemText: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  link: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    textDecorationLine: "underline",
  },
  body: {
    marginTop: spacing.sm,
    marginLeft: 32,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  check: {
    color: colors.onPrimary,
    fontSize: fontSize.small,
    fontWeight: "700",
  },
  footer: {
    marginTop: spacing.lg,
  },
});
