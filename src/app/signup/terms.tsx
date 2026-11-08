// ys-001 회원가입 · F-101 약관 동의
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import StepIndicator from "@/components/StepIndicator";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { type LegalDoc, openLegal } from "@/lib/legal";

// 동의 항목. 요약은 화면에서 펼치고, 전문은 노션 페이지 (원본 docs/legal/, 2026-10-30 개발팀 초안)
type Term = { key: string; title: string; body: string; doc?: LegalDoc };

// 이용약관은 학생·단체 공통
const SERVICE_TERM: Term = {
  key: "service",
  title: "[필수] 이용약관 동의",
  body:
    "· 포인트는 앱 안에서만 쓰며 현금·기프티콘으로 바꿀 수 없어요. 탈퇴하면 사라져요.\n" +
    "· 광고, 욕설·혐오, 개인정보(이름·연락처·학번)나 민감한 정보를 묻는 설문은 올릴 수 없어요.\n" +
    "· 신고가 쌓인 설문은 숨겨지고, 규칙을 어긴 설문은 등록비 없이 삭제될 수 있어요.\n" +
    "· 대충 응답하거나 여러 계정을 쓰면 포인트를 회수하거나 이용을 제한할 수 있어요.",
  doc: "terms",
};

// 학생 회원
const STUDENT_TERMS: Term[] = [
  {
    key: "age",
    title: "[필수] 만 14세 이상이에요",
    body: "만 14세 미만은 가입할 수 없어요.",
  },
  SERVICE_TERM,
  {
    key: "privacy",
    title: "[필수] 개인정보 수집·이용 동의",
    body:
      "· 수집 항목: 학교 메일, 닉네임, 학교, 전공 계열, 과정, 입학년도, 성별, 출생연도\n" +
      "· 목적: 대학생 인증, 회원 식별, 응답 대상 구분, 계열·학년·성별·나이대별 통계\n" +
      "· 보관 기간: 탈퇴할 때까지 (탈퇴하면 바로 삭제)\n" +
      "· 동의하지 않을 수 있지만, 동의하지 않으면 가입할 수 없어요.",
    doc: "privacy",
  },
  {
    key: "results",
    title: "[필수] 응답 결과의 통계 공개 동의",
    body:
      "· 내 응답은 누가 답했는지 알 수 없게 묶은 통계로 등록자에게 제공되고, 공개 설문이면 다른 회원에게도 보여요.\n" +
      "· 5명 미만 묶음은 공개하지 않아요. 주관식 원문은 등록자만 봐요.\n" +
      "· 탈퇴해도 응답은 개인을 알 수 없는 상태로 통계에 남아요.\n" +
      "· 응답을 외부 기업에 팔거나 제공하지 않아요.",
    doc: "privacy",
  },
];

// 단체 회원 (2026-11-09 팀 피드백: 단체는 응답을 하지 않으니 나이·응답 통계 동의 대신 대표 권한·결과 공개 책임)
const ORG_TERMS: Term[] = [
  {
    key: "authority",
    title: "[필수] 단체를 대표해 가입할 권한이 있어요",
    body:
      "· 이 단체의 담당자이거나, 단체로부터 가입을 맡은 사람이어야 해요.\n" +
      "· 승인 전에 증빙 링크(공식 SNS·홈페이지 등)로 단체를 확인해요.\n" +
      "· 다른 단체를 사칭하면 계정이 삭제되고 법적 책임을 질 수 있어요.",
  },
  SERVICE_TERM,
  {
    key: "privacy",
    title: "[필수] 개인정보 수집·이용 동의",
    body:
      "· 수집 항목: 공식 메일, 단체 이름·종류·소속 학교, 증빙 링크, 소개\n" +
      "· 목적: 단체 확인·승인, 설문 주최 표시\n" +
      "· 보관 기간: 탈퇴할 때까지 (탈퇴하면 바로 삭제)\n" +
      "· 동의하지 않을 수 있지만, 동의하지 않으면 가입할 수 없어요.",
    doc: "privacy",
  },
  {
    key: "orgResults",
    title: "[필수] 결과 공개와 응답자 개인정보 보호에 동의해요",
    // TODO(임시): "지금은 단체 설문은 결과 공개가 필수" · Q14 기획팀 답으로 비공개 규칙이 바뀌면 이 문장도 고치기 · docs/PROGRESS.md
    body:
      "· 결과 공개를 고른 설문은 누가 답했는지 알 수 없는 통계로 공개돼요. 지금은 단체 설문은 결과 공개가 필수예요.\n" +
      "· 응답자에게 이름·연락처·학번 같은 개인정보나 민감한 정보를 묻지 않아요.\n" +
      "· 받은 응답과 보상 연락처는 그 설문의 목적으로만 쓰고, 외부에 제공하지 않아요.",
    doc: "terms",
  },
];

export default function SignupTerms() {
  // type: 학생(student) / 단체(org), 가입 유형 선택 화면에서 넘어온다
  // resume=1: 인증만 하고 가입을 마치지 않은 사람이 이어서 하는 경우 (useResumeSignup)
  const { type, resume } = useLocalSearchParams<{ type?: string; resume?: string }>();
  const isOrg = type === "org";
  const isResume = resume === "1";
  const terms = isOrg ? ORG_TERMS : STUDENT_TERMS;

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [opened, setOpened] = useState<string | null>(null);

  const allChecked = terms.every((t) => checked[t.key]);

  const toggleAll = () => {
    const next = !allChecked;
    setChecked(Object.fromEntries(terms.map((t) => [t.key, next])));
  };

  const toggle = (key: string) => {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const goNext = () => {
    if (isResume) {
      // 이미 인증된 상태라 이메일·인증번호를 건너뛰고 회원정보(학생) 또는 단체 정보로.
      // 쌓인 화면을 걷어내 뒤로 가기로 돌아오지 않게 한다
      router.dismissAll();
      router.replace({
        pathname: isOrg ? "/signup/org-info" : "/signup/profile",
        params: { agreed: "1" },
      });
      return;
    }
    router.push({
      pathname: "/signup/email",
      params: { agreed: "1", type: isOrg ? "org" : "student" },
    });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Stack.Screen options={{ title: "회원가입" }} />

      {isResume && <Text style={styles.notice}>가입을 이어서 진행할게요.</Text>}
      <StepIndicator current={2} total={5} />
      <Text style={styles.heading}>약관에 동의해 주세요</Text>

      <Pressable style={[styles.row, styles.allRow]} onPress={toggleAll}>
        <CheckBox checked={allChecked} />
        <Text style={styles.allText}>전체 동의</Text>
      </Pressable>

      {terms.map((t) => (
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
          {opened === t.key && (
            <View style={styles.bodyBox}>
              <Text style={styles.body}>{t.body}</Text>
              {t.doc && (
                <Pressable onPress={() => openLegal(t.doc as LegalDoc)} hitSlop={8}>
                  <Text style={styles.link}>전문 보기 ›</Text>
                </Pressable>
              )}
            </View>
          )}
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
  bodyBox: {
    marginTop: spacing.sm,
    marginLeft: 32,
    gap: spacing.sm,
  },
  body: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    lineHeight: 20,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
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
