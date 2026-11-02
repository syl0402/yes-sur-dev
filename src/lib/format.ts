// 화면에 보여줄 값의 형식을 맞춘다.

// 포인트: 1000 → "1,000P"
export function formatPoints(points: number): string {
  return `${points.toLocaleString("ko-KR")}P`;
}

// 얼마 전인지: 방금 · n분 전 · n시간 전 · 어제 · 11.2 (올해) · 2025.11.2 (2026-11-02)
export function formatAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}시간 전`;
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (d >= yesterday) return "어제";
  if (d.getFullYear() === today.getFullYear()) return `${d.getMonth() + 1}.${d.getDate()}`;
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

// 날짜와 시각: "11/01 20:37" (올해) · "2025/11/01 20:37" (2026-11-03, 댓글·글 상세)
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.getFullYear() === new Date().getFullYear() ? day : `${d.getFullYear()}/${day}`;
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
