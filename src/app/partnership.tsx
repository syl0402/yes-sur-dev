// ys-171 제휴·광고 문의 · F-902 확장 (2026-11-07 팀 피드백, 푸망 문의 폼 참고)
// 담당자 정보 → 알게 된 경로(필수, 기타는 직접 입력) → 브랜드 → 문의 내용 → [필수] 개인정보 수집 동의 → 내가 보낸 문의.
// 운영자가 전화·메일로 답한다
// 2026-11-14 마이 탭 시안 ⑩: "어떤 곳인가요?"(첫 칸 이름·예시가 바뀜) · "무엇을 하고 싶나요?"(여러 개) 칩 → 문의 내용 앞에 [종류 · 하고 싶은 것]으로 붙여 보낸다
// (서버 표는 그대로. 휴대폰은 서버에서 필수라 그대로 필수, 알게 된 경로는 맨 아래로)
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import Chips from "@/components/create/Chips";
import Chip from "@/components/ui/Chip";
import { formStyles } from "@/components/create/formStyles";
import PrimaryButton from "@/components/PrimaryButton";
import CheckRow from "@/components/ui/CheckRow";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { showNotice } from "@/lib/notice";
import { fetchRules } from "@/lib/rules";
import { supabase } from "@/lib/supabase";

type Source = "store" | "friend" | "sns" | "community" | "search" | "school" | "other";

// 마케팅 경로 파악용 (2026-11-07). 바꾸면 서버 send_partnership_inquiry 목록도 같이
const SOURCES: { value: Source; label: string }[] = [
  { value: "store", label: "플레이스토어" },
  { value: "friend", label: "지인 소개" },
  { value: "sns", label: "SNS" },
  { value: "community", label: "에브리타임·커뮤니티" },
  { value: "search", label: "검색 (네이버·구글)" },
  { value: "school", label: "학교·학생회" },
  { value: "other", label: "기타" },
];

const BODY_MAX = 1000;

type OrgType = "brand" | "agency" | "student" | "other";

// 어떤 곳인가요? → 첫 칸 이름 · 예시
const ORG_TYPES: { value: OrgType; label: string; field: string; placeholder: string }[] = [
  { value: "brand", label: "기업·브랜드", field: "회사·브랜드 이름", placeholder: "예: 옛썰커피" },
  { value: "agency", label: "광고 대행사", field: "대행사 이름", placeholder: "예: ○○애드" },
  { value: "student", label: "학생회·동아리", field: "학교 · 단체 이름", placeholder: "예: 중앙대 총학생회" },
  { value: "other", label: "기타", field: "회사·단체 이름", placeholder: "회사·단체 이름" },
];

type Purpose = "survey" | "ad" | "event";

// 무엇을 하고 싶나요? (여러 개)
const PURPOSES: { value: Purpose; label: string }[] = [
  { value: "survey", label: "설문 의뢰" },
  { value: "ad", label: "광고·배너" },
  { value: "event", label: "이벤트 제휴" },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "확인 중",
  answered: "연락드림",
  done: "처리 완료",
};

type MyInquiry = { id: number; brand: string; body: string; status: string; created_at: string };

export default function Partnership() {
  const [orgType, setOrgType] = useState<OrgType>("brand");
  const [purposes, setPurposes] = useState<Purpose[]>([]);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState<Source | null>(null);
  const [sourceEtc, setSourceEtc] = useState("");
  const [brand, setBrand] = useState("");
  const [body, setBody] = useState("");
  const [consent, setConsent] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // 보관 일수 (동의 안내에 표시, point_rules)
  const [keepDays, setKeepDays] = useState<number | null>(null);
  // 내가 보낸 문의 (본인 것만 읽힌다)
  const [mine, setMine] = useState<MyInquiry[]>([]);

  const load = useCallback(() => {
    supabase
      .from("partnership_inquiries")
      .select("id, brand, body, status, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setMine((data as MyInquiry[] | null) ?? []));
  }, []);

  useFocusEffect(load);

  // 단체 계정이면 단체 이름·가입 메일을 미리 채운다 (고칠 수 있음)
  useEffect(() => {
    fetchRules(["partnership_keep_days"]).then((r) => setKeepDays(r.partnership_keep_days ?? null));
    Promise.all([
      supabase.auth.getUser(),
      supabase.from("profiles").select("account_type").maybeSingle(),
      supabase.from("organizations").select("name").maybeSingle(),
    ]).then(([{ data: auth }, { data: profile }, { data: org }]) => {
      if (profile?.account_type !== "org") return;
      if (org?.name) setCompany((c) => c || org.name);
      if (auth.user?.email) setEmail((e) => e || (auth.user?.email ?? ""));
    });
  }, []);

  const ready =
    name.trim() !== "" &&
    company.trim() !== "" &&
    phone.trim() !== "" &&
    email.trim() !== "" &&
    source !== null &&
    (source !== "other" || sourceEtc.trim() !== "") &&
    brand.trim() !== "" &&
    body.trim() !== "" &&
    consent;

  const send = async () => {
    if (!ready || sending) return;
    setSending(true);
    setError("");
    const { error: sendError } = await supabase.rpc("send_partnership_inquiry", {
      p_contact_name: name.trim(),
      p_company: company.trim(),
      p_job_title: jobTitle.trim(),
      p_phone: phone.trim(),
      p_email: email.trim(),
      p_source: source ?? undefined,
      p_source_etc: source === "other" ? sourceEtc.trim() : undefined,
      p_brand: brand.trim(),
      p_body: withTags(body.trim()),
      p_consent: consent,
    });
    setSending(false);
    if (sendError) {
      setError(errorMessage(sendError));
      return;
    }
    setBrand("");
    setBody("");
    setConsent(false);
    load();
    showNotice("문의를 접수했어요", "남겨 주신 연락처로 빠르게 연락드릴게요. 아래 '내가 보낸 문의'에서 확인할 수 있어요.");
  };

  const org = ORG_TYPES.find((o) => o.value === orgType) ?? ORG_TYPES[0];
  // 문의 내용 앞에 고른 칩을 붙인다: "[기업·브랜드 · 설문 의뢰, 광고·배너] …"
  function withTags(text: string) {
    const picked = PURPOSES.filter((p) => purposes.includes(p.value)).map((p) => p.label);
    const tag = [org.label, picked.join(", ")].filter(Boolean).join(" · ");
    return `[${tag}] ${text}`.slice(0, BODY_MAX);
  }
  const togglePurpose = (p: Purpose) =>
    setPurposes((all) => (all.includes(p) ? all.filter((x) => x !== p) : [...all, p]));

  const keep = keepDays !== null ? `접수 후 ${keepDays}일 뒤 자동 삭제` : "접수 후 일정 기간 뒤 자동 삭제";

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "제휴·광고 문의" }} />

      <View style={styles.intro}>
        <Text style={styles.heading}>옛썰과 함께해요</Text>
        <Text style={styles.lead}>
          학교 메일로 인증된 대학생들이 모인 옛썰과 함께 설문·이벤트를 진행하고, 브랜드를 홍보해 보세요. 아래 폼을
          채워 주시면 옛썰에서 빠르게 회신드릴게요.
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>어떤 곳인가요?</Text>
        <Chips options={ORG_TYPES} selected={orgType} onSelect={setOrgType} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          무엇을 하고 싶나요? <Text style={styles.labelLight}>여러 개 가능</Text>
        </Text>
        <View style={formStyles.chips}>
          {PURPOSES.map((p) => (
            <Chip key={p.value} label={p.label} selected={purposes.includes(p.value)} onPress={() => togglePurpose(p.value)} />
          ))}
        </View>
      </View>

      <View style={formStyles.card}>
        <Text style={formStyles.label}>{org.field}</Text>
        <TextInput
          style={formStyles.input}
          value={company}
          onChangeText={setCompany}
          placeholder={org.placeholder}
          maxLength={50}
        />
        <Text style={formStyles.label}>담당자 성함</Text>
        <TextInput style={formStyles.input} value={name} onChangeText={setName} placeholder="홍길동" maxLength={30} />
        <TextInput
          style={formStyles.input}
          value={jobTitle}
          onChangeText={setJobTitle}
          placeholder="직함 (선택)"
          maxLength={30}
        />
        <Text style={formStyles.label}>휴대폰 번호</Text>
        <TextInput
          style={formStyles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="010-0000-0000"
          keyboardType="phone-pad"
          maxLength={13}
        />
        <Text style={formStyles.label}>연락받을 이메일</Text>
        <TextInput
          style={formStyles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="name@company.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={100}
        />
      </View>

      <View style={formStyles.card}>
        <Text style={formStyles.label}>홍보할 브랜드·서비스</Text>
        <TextInput
          style={formStyles.input}
          value={brand}
          onChangeText={setBrand}
          placeholder="홍보할 브랜드·서비스명"
          maxLength={50}
        />
        <Text style={formStyles.hint}>대행사는 광고주의 브랜드·서비스명을 적어 주세요.</Text>
        <TextInput
          style={[formStyles.input, formStyles.multiline, styles.body]}
          value={body}
          onChangeText={setBody}
          placeholder={"문의 내용\n예) ○○대학교 총학생회입니다.\n12월에 대학생 대상 설문 이벤트를 진행하고 싶어서 문의드립니다."}
          maxLength={BODY_MAX}
          multiline
        />
        <Text style={formStyles.hint}>
          {body.length} / {BODY_MAX}자
        </Text>
      </View>

      <View style={formStyles.card}>
        <Text style={formStyles.label}>옛썰을 어디서 처음 알게 됐나요?</Text>
        <Chips options={SOURCES} selected={source} onSelect={setSource} />
        {source === "other" && (
          <TextInput
            style={formStyles.input}
            value={sourceEtc}
            onChangeText={setSourceEtc}
            placeholder="어디서 알게 됐는지 적어 주세요"
            maxLength={50}
          />
        )}
      </View>

      {/* 동의 체크는 다른 화면(보상 연락처)과 같은 작은 체크 줄 (2026-11-12) */}
      <CheckRow label="[필수] 개인정보 수집 동의" checked={consent} onPress={() => setConsent(!consent)} />
      <Pressable onPress={() => setShowTerms(!showTerms)} hitSlop={8}>
        <Text style={styles.termsLink}>{showTerms ? "내용 접기 ▴" : "내용 보기 ▾"}</Text>
      </Pressable>
      {showTerms && (
        <View style={styles.terms}>
          <Text style={styles.termsText}>
            · 수집 항목: 성함, 회사·단체 이름, 직함(선택), 휴대폰 번호, 이메일{"\n"}· 목적: 제휴·광고 문의 확인과 답변
            {"\n"}· 보관: {keep}
            {"\n"}동의하지 않을 수 있지만, 동의하지 않으면 문의를 보낼 수 없어요.
          </Text>
        </View>
      )}

      {error !== "" && <Text style={formStyles.error}>{error}</Text>}

      <PrimaryButton title="제휴 문의하기" onPress={send} disabled={!ready} loading={sending} />

      {mine.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.groupTitle}>내가 보낸 문의</Text>
          {mine.map((m) => (
            <View key={m.id} style={formStyles.card}>
              <View style={styles.itemHead}>
                <Text style={styles.meta}>
                  {m.brand} · {formatDate(m.created_at)}
                </Text>
                <Text style={[styles.status, m.status !== "pending" && styles.statusDone]}>
                  {STATUS_LABELS[m.status] ?? "확인 중"}
                </Text>
              </View>
              <Text style={styles.itemBody} numberOfLines={3}>
                {m.body}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 20,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  intro: {
    gap: spacing.sm,
  },
  heading: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
  },
  lead: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
  },
  body: {
    minHeight: 140,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.iconStrong,
  },
  labelLight: {
    fontSize: fontSize.caption,
    fontWeight: "400",
    color: colors.textMuted,
  },
  termsLink: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    textDecorationLine: "underline",
  },
  terms: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  section: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  groupTitle: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.textMuted,
  },
  itemHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  meta: {
    flex: 1,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  status: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.textMuted,
  },
  statusDone: {
    color: colors.primary,
  },
  itemBody: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  termsText: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    lineHeight: 20,
  },
});
