// 응답자 정보(성별·출생연도) 선택지. 서버 check_demographics와 같은 규칙 (서버가 한 번 더 검사한다)

export type Gender = "male" | "female" | "undisclosed";

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "남성" },
  { value: "female", label: "여성" },
  { value: "undisclosed", label: "선택 안 함" },
];

// 출생연도 범위: 올해 기준 만 14세 ~ 60세쯤 (대학생·대학원생)
const YOUNGEST_AGE = 14;
const OLDEST_AGE = 60;

// 고를 수 있는 출생연도 (최근 연도부터)
export function birthYearOptions(currentYear: number): number[] {
  return Array.from({ length: OLDEST_AGE - YOUNGEST_AGE + 1 }, (_, i) => currentYear - YOUNGEST_AGE - i);
}
