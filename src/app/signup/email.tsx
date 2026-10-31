// ys-001 회원가입 · F-102 학교 선택·이메일 입력 (단체는 아무 메일)
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import PrimaryButton from "@/components/PrimaryButton";
import StepIndicator from "@/components/StepIndicator";
import { Text, TextInput } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

// 학교 + 학생 메일 주소들 (대표 주소가 먼저). 2026-10-31부터 학교 하나에 주소 여러 개
type University = {
  id: number;
  name: string;
  email_domain: string;
  university_domains: { domain: string; is_primary: boolean }[];
};

// 학교의 메일 주소 목록 (대표 먼저, 표가 비면 예전 대표 주소)
function domainsOf(u: University): string[] {
  const list = [...(u.university_domains ?? [])]
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    .map((d) => d.domain);
  return list.length > 0 ? list : [u.email_domain];
}

// 학교가 이만큼 넘으면 검색해서 고르기 (검색 결과는 최대 SEARCH_RESULTS_MAX개)
const SEARCH_FROM = 6;
const SEARCH_RESULTS_MAX = 6;

// 단체 메일 형식 검사 (자세한 검사는 인증번호 메일이 대신한다)
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupEmail() {
  const { agreed, type } = useLocalSearchParams<{ agreed?: string; type?: string }>();
  const isOrg = type === "org";

  const [universities, setUniversities] = useState<University[]>([]);
  const [selected, setSelected] = useState<University | null>(null);
  const [domain, setDomain] = useState("");
  const [search, setSearch] = useState("");
  const [localPart, setLocalPart] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // 이미 가입된 것으로 확인된 메일 (입력을 바꾸면 안내가 사라진다)
  const [registeredEmail, setRegisteredEmail] = useState("");

  // 학교를 고르면 대표 메일 주소로 맞춘다
  const pick = (u: University) => {
    setSelected(u);
    setDomain(domainsOf(u)[0]);
  };

  useEffect(() => {
    supabase
      .from("universities")
      .select("id, name, email_domain, university_domains(domain, is_primary)")
      .order("name")
      .then(({ data, error }) => {
        if (error) {
          setError(errorMessage(error));
          return;
        }
        const list = (data as University[] | null) ?? [];
        setUniversities(list);
        // 학교가 하나뿐이면 미리 골라 둔다
        if (list.length === 1) pick(list[0]);
      });
  }, []);

  // 학교가 많으면 검색해서 고르기 (검색어가 없으면 목록을 보여 주지 않는다), 적으면 전체 목록
  const useSearch = universities.length >= SEARCH_FROM;
  const q = search.trim();
  const shown = !useSearch
    ? universities
    : q
      ? universities.filter((u) => u.name.includes(q)).slice(0, SEARCH_RESULTS_MAX)
      : [];

  // 학생: 학교 선택 + 아이디 (도메인 고정)
  const trimmed = localPart.trim();
  const isValidLocalPart = trimmed.length > 0 && !/[\s@]/.test(trimmed);
  // 단체: 메일 주소 전체
  const trimmedOrgEmail = orgEmail.trim();
  const isValidOrgEmail = EMAIL_PATTERN.test(trimmedOrgEmail);

  const canSend = isOrg ? isValidOrgEmail : selected !== null && isValidLocalPart;
  const email = isOrg ? trimmedOrgEmail : `${trimmed}@${domain}`;
  const alreadyRegistered = registeredEmail !== "" && registeredEmail === email;

  const sendCode = async () => {
    if (!canSend) return;
    setSending(true);
    setError("");

    // 이미 가입을 마친 메일이면 인증번호를 보내지 않고 로그인으로 안내한다 (2026-10-27 결정)
    const { data: registered } = await supabase.rpc("is_email_registered", { p_email: email });
    if (registered === true) {
      setSending(false);
      setRegisteredEmail(email);
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    setSending(false);
    if (error) {
      setError(errorMessage(error));
      return;
    }
    router.push({ pathname: "/signup/verify", params: { email, agreed, type } });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "회원가입" }} />

      <StepIndicator current={3} total={5} />
      {isOrg ? (
        <>
          <Text style={styles.heading}>단체 공식 메일을 입력해 주세요</Text>
          <Text style={styles.guide}>
            학생회·동아리 공식 메일이나 기관·회사 메일을 써 주세요. 승인할 때 단체 확인에 참고하고,
            로그인 아이디로도 써요.
          </Text>
          <TextInput
            style={styles.input}
            value={orgEmail}
            onChangeText={setOrgEmail}
            placeholder="example@gmail.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          {orgEmail.length > 0 && !isValidOrgEmail && (
            <Text style={styles.error}>메일 주소 형식을 확인해 주세요.</Text>
          )}
        </>
      ) : (
        <Text style={styles.heading}>학교를 선택해 주세요</Text>
      )}

      {/* 고른 뒤: 선택한 학교 하나 + [변경] (목록을 접어서 화면이 길어지지 않게) */}
      {!isOrg && selected && (useSearch || universities.length > 1) && (
        <View style={[styles.school, styles.schoolSelected, styles.pickedRow]}>
          <View style={styles.pickedMain}>
            <Text style={styles.schoolName}>{selected.name}</Text>
            <Text style={styles.schoolDomain}>{domainsOf(selected).map((d) => `@${d}`).join(" · ")}</Text>
          </View>
          <Pressable
            onPress={() => {
              setSelected(null);
              setSearch("");
            }}
            hitSlop={8}
          >
            <Text style={styles.change}>변경</Text>
          </Pressable>
        </View>
      )}

      {/* 고르기 전: 학교가 많으면 검색해서 고르기, 적으면 전체 */}
      {!isOrg && !selected && (
        <>
          {useSearch && (
            <TextInput
              style={styles.input}
              value={search}
              onChangeText={setSearch}
              placeholder="학교 이름을 입력해 주세요 (예: 중앙)"
              autoCorrect={false}
            />
          )}
          {useSearch && q === "" && <Text style={styles.guide}>학교 이름 일부만 입력해도 찾아요.</Text>}
          {shown.map((u) => (
            <Pressable key={u.id} style={styles.school} onPress={() => pick(u)}>
              <Text style={styles.schoolName}>{u.name}</Text>
              <Text style={styles.schoolDomain}>{domainsOf(u).map((d) => `@${d}`).join(" · ")}</Text>
            </Pressable>
          ))}
          {q !== "" && shown.length === 0 && (
            <Text style={styles.guide}>찾는 학교가 없어요. 아직 가입할 수 없는 학교예요.</Text>
          )}
        </>
      )}

      {!isOrg && selected && (
        <>
          <Text style={styles.label}>학교 이메일</Text>
          {/* 학교 메일 주소가 여러 개면 고르기 (예: 포털 메일 · 학생용 구글 메일) */}
          {domainsOf(selected).length > 1 && (
            <View style={styles.domainChips}>
              {domainsOf(selected).map((d) => (
                <Pressable
                  key={d}
                  style={[styles.domainChip, d === domain && styles.domainChipOn]}
                  onPress={() => setDomain(d)}
                >
                  <Text style={[styles.domainChipText, d === domain && styles.domainChipTextOn]}>@{d}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <View style={styles.emailRow}>
            <TextInput
              style={styles.input}
              value={localPart}
              onChangeText={setLocalPart}
              placeholder="아이디"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            <Text style={styles.domain}>@{domain}</Text>
          </View>
          {localPart.length > 0 && !isValidLocalPart && (
            <Text style={styles.error}>@ 앞부분만 입력해 주세요.</Text>
          )}
        </>
      )}

      {error !== "" && <Text style={styles.error}>{error}</Text>}

      {alreadyRegistered ? (
        <View style={styles.registeredBox}>
          <Text style={styles.registeredText}>이미 가입된 메일이에요. 로그인해 주세요.</Text>
          <PrimaryButton
            title="로그인하기"
            onPress={() => {
              // 쌓인 가입 화면을 걷어내고 로그인 화면으로
              router.dismissAll();
              router.push("/login");
            }}
          />
        </View>
      ) : (
        <View style={styles.footer}>
          <PrimaryButton
            title="인증번호 보내기"
            onPress={sendCode}
            disabled={!canSend}
            loading={sending}
          />
        </View>
      )}
    </ScrollView>
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
  heading: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  guide: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  registeredBox: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  registeredText: {
    fontSize: fontSize.body,
    color: colors.danger,
    textAlign: "center",
  },
  school: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  schoolSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  pickedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  pickedMain: {
    flex: 1,
  },
  change: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.primary,
  },
  schoolName: {
    fontSize: fontSize.body,
    color: colors.text,
    fontWeight: "600",
  },
  schoolDomain: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  label: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  domainChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  domainChip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  domainChipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  domainChipText: {
    fontSize: fontSize.small,
    color: colors.text,
  },
  domainChipTextOn: {
    color: colors.onPrimary,
    fontWeight: "700",
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    fontSize: fontSize.body,
    color: colors.text,
  },
  domain: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  error: {
    fontSize: fontSize.small,
    color: colors.danger,
  },
  footer: {
    marginTop: spacing.lg,
  },
});
