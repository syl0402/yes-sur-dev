// 설문 길이 구간 (예상 시간, 2026-11-03). 서버 calc_survey_reward·calc_survey_price와 같은 기준
// 보상은 point_rules의 reward_{구간}, 등록비(응답 1명당)는 price_{구간}
export type Band = "1q" | "le3" | "3to7" | "7to15" | "gte15";

export const BANDS: { key: Band; label: string }[] = [
  { key: "1q", label: "1문항" },
  { key: "le3", label: "3분 이내" },
  { key: "3to7", label: "3~7분" },
  { key: "7to15", label: "7~15분" },
  { key: "gte15", label: "15분 이상" },
];

// 예상 분은 올림한 정수 (서버와 같음)
export function bandOf(questionCount: number, minutes: number): Band {
  if (questionCount === 1) return "1q";
  if (minutes <= 3) return "le3";
  if (minutes <= 7) return "3to7";
  if (minutes < 15) return "7to15";
  return "gte15";
}

// 시간만 보는 구간 (설문 목록 소요시간 필터. 1문항 설문은 "3분 이내"에 들어감)
export function timeBandOf(minutes: number): Exclude<Band, "1q"> {
  const band = bandOf(2, minutes);
  return band === "1q" ? "le3" : band;
}

export const BAND_RULE_KEYS = BANDS.flatMap((b) => [`reward_${b.key}`, `price_${b.key}`]);
