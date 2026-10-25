import { useState } from "react";
import { Button, ScrollView, Text, TextInput, StyleSheet } from "react-native";

import { supabase } from "@/lib/supabase";

// 개발용 테스트 화면: 이메일 인증번호(OTP) 발송·확인만 확인한다.
export default function OtpTest() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [log, setLog] = useState<string[]>([]);

  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    setLog((prev) => [`[${time}] ${message}`, ...prev]);
  };

  const sendCode = async () => {
    addLog(`발송 요청: ${email}`);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    if (error) {
      addLog(`발송 실패: ${error.message} (status ${error.status ?? "-"}, code ${error.code ?? "-"})`);
    } else {
      addLog("발송 성공: 메일함(스팸함 포함)을 확인하세요.");
    }
  };

  const verifyCode = async () => {
    addLog(`확인 요청: ${code}`);
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      addLog(`확인 실패: ${error.message} (status ${error.status ?? "-"}, code ${error.code ?? "-"})`);
    } else {
      addLog(`인증 성공: user id ${data.user?.id}`);
    }
  };

  const checkSession = async () => {
    const { data } = await supabase.auth.getSession();
    addLog(data.session ? `로그인 상태: ${data.session.user.email}` : "로그인 안 됨");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    addLog("로그아웃 완료");
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text>이메일</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="test@school.ac.kr"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
      />
      <Button title="인증번호 보내기" onPress={sendCode} />

      <Text>인증번호</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        placeholder="메일로 받은 숫자"
        keyboardType="number-pad"
        maxLength={10}
      />
      <Button title="인증번호 확인" onPress={verifyCode} />

      <Button title="로그인 상태 확인" onPress={checkSession} />
      <Button title="로그아웃" onPress={signOut} />

      <Text>기록 (최신이 위)</Text>
      {log.map((line, i) => (
        <Text key={i} selectable>
          {line}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#999",
    padding: 10,
  },
});
