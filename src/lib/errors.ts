// 서버·인증 오류를 화면에 보여줄 한국어 문구로 바꾼다.
// 서버 함수 오류 코드는 docs/DB.md, 화면 문구는 docs/HANDOFF.md와 맞춘다.

const MESSAGES: Record<string, string> = {
  // 서버 함수 (complete_signup 등)
  not_authenticated: "다시 로그인해 주세요.",
  email_not_verified: "이메일 인증을 먼저 완료해 주세요.",
  domain_not_allowed: "가입할 수 있는 학교 이메일이 아니에요.",
  terms_not_agreed: "필수 약관에 동의해 주세요.",
  invalid_nickname: "닉네임은 2~12자로 입력해 주세요.",
  nickname_taken: "이미 사용 중인 닉네임이에요.",
  invalid_department: "학과를 입력해 주세요.",
  invalid_degree_type: "과정을 선택해 주세요.",
  invalid_admission_year: "입학년도를 선택해 주세요.",

  // Supabase 인증
  over_email_send_rate_limit: "잠시 후 다시 보내 주세요.",
  otp_expired: "인증번호가 틀렸거나 만료됐어요.",
};

const DEFAULT_MESSAGE = "잠시 후 다시 시도해 주세요.";

type ErrorLike = { code?: string; message?: string } | null | undefined;

export function errorMessage(error: ErrorLike): string {
  if (!error) return DEFAULT_MESSAGE;
  // 인증 오류는 code에, 서버 함수 오류는 message에 코드가 온다
  return MESSAGES[error.code ?? ""] ?? MESSAGES[error.message ?? ""] ?? DEFAULT_MESSAGE;
}
