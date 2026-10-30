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
  invalid_major_field: "전공 계열을 선택해 주세요.",
  invalid_degree_type: "과정을 선택해 주세요.",
  invalid_admission_year: "입학년도를 선택해 주세요.",
  already_student: "이미 학생으로 가입한 메일이에요. 단체는 다른 메일로 가입해 주세요.",
  invalid_org_kind: "단체 종류를 선택해 주세요.",
  invalid_org_name: "단체 이름은 2~30자로 입력해 주세요.",
  invalid_org_university: "학교를 선택해 주세요.",
  invalid_org_evidence: "증빙 링크는 http:// 또는 https://로 시작해야 해요.",
  invalid_org_description: "소개는 200자까지 쓸 수 있어요.",
  org_name_taken: "같은 이름의 단체가 이미 있어요.",

  // 응답 제출 (submit_response)
  not_student: "학생 계정만 설문에 응답할 수 있어요.",
  survey_not_found: "찾을 수 없는 설문이에요.",
  own_survey: "내가 올린 설문에는 응답할 수 없어요.",
  survey_closed: "마감된 설문이에요.",
  survey_full: "응답 인원이 다 찼어요.",
  not_target: "응답 대상이 아닌 설문이에요.",
  already_responded: "이미 참여한 설문이에요.",
  invalid_answers: "모든 문항에 답해 주세요.",

  // 설문 등록 (create_survey)
  org_not_approved: "승인된 단체만 설문을 등록할 수 있어요.",
  not_allowed: "설문을 등록할 수 없는 계정이에요.",
  invalid_title: "제목은 2~60자로 입력해 주세요.",
  invalid_description: "설명은 500자까지 쓸 수 있어요.",
  invalid_category: "카테고리를 선택해 주세요.",
  invalid_audience: "응답 대상을 다시 선택해 주세요.",
  invalid_target: "목표 인원을 다시 확인해 주세요.",
  invalid_days: "마감 기간을 다시 확인해 주세요.",
  invalid_questions: "문항과 선택지를 다시 확인해 주세요.",
  insufficient_points: "포인트가 부족해요.",

  // 결과 보기·마감 (get_survey_results, close_survey)
  not_owner: "내 설문만 볼 수 있어요.",
  invalid_visibility: "학교가 없는 계정은 '우리 학교만'을 고를 수 없어요.",

  // 응답자 정보 (complete_signup, update_my_demographics)
  invalid_gender: "성별을 선택해 주세요.",
  invalid_birth_year: "출생연도를 선택해 주세요.",
  demographics_locked: "이미 입력한 정보예요. 고치려면 문의해 주세요.",
  report_own_survey: "내 설문은 신고할 수 없어요.",
  already_reported: "이미 신고한 설문이에요. 운영자가 확인하고 있어요.",
  invalid_reason: "신고 사유를 골라 주세요.",
  survey_hidden: "신고가 접수되어 잠시 숨겨진 설문이에요.",
  org_must_publish: "단체 설문은 테스트 기간 동안 결과를 공개하는 조건으로 무료예요.",

  // Supabase 인증
  over_email_send_rate_limit: "잠시 후 다시 보내 주세요.",
  otp_expired: "인증번호가 틀렸거나 만료됐어요.",
  weak_password: "비밀번호가 너무 쉬워요. 8자 이상으로 정해 주세요.",
  invalid_credentials: "이메일 또는 비밀번호가 맞지 않아요.",
  email_not_confirmed: "이메일 인증을 먼저 완료해 주세요.",
  over_request_rate_limit: "잠시 후 다시 시도해 주세요.",
};

const DEFAULT_MESSAGE = "잠시 후 다시 시도해 주세요.";

type ErrorLike = { code?: string; message?: string } | null | undefined;

export function errorMessage(error: ErrorLike): string {
  if (!error) return DEFAULT_MESSAGE;
  // 인증 오류는 code에, 서버 함수 오류는 message에 코드가 온다
  const known = MESSAGES[error.code ?? ""] ?? MESSAGES[error.message ?? ""];
  if (known) return known;

  // 모르는 오류: 개발 중(__DEV__)에만 원인을 같이 보여준다. 출시 앱에는 안 보인다
  if (__DEV__) {
    return `${DEFAULT_MESSAGE}\n[개발용] ${error.code ?? "-"} / ${error.message ?? "-"}`;
  }
  return DEFAULT_MESSAGE;
}
