// 화면에 보여줄 값의 형식을 맞춘다.

// 포인트: 1000 → "1,000P"
export function formatPoints(points: number): string {
  return `${points.toLocaleString("ko-KR")}P`;
}

// 날짜: "2026-10-29T..." → "2026.10.29"
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}.${mm}.${dd}`;
}

// 마감까지 남은 시간: "3일 남음" / "5시간 남음" / "곧 마감" / "마감" (마감일이 없으면 빈 문자열)
export function formatTimeLeft(closesAt: string | null): string {
  if (!closesAt) return "";
  const ms = new Date(closesAt).getTime() - Date.now();
  if (ms <= 0) return "마감";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours >= 24) return `${Math.floor(hours / 24)}일 남음`;
  if (hours >= 1) return `${hours}시간 남음`;
  return "곧 마감";
}
