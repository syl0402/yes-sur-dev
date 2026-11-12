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

// 댓글 시각 (에브리타임 방식): 1시간 안은 방금 · n분 전, 그 뒤는 "11/01 20:37" (올해) · "2025/11/01 20:37" (2026-11-10)
export function formatCommentTime(iso: string): string {
  const d = new Date(iso);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.getFullYear() === new Date().getFullYear() ? day : `${d.getFullYear()}/${day}`;
}

// 짧은 날짜: 올해면 "11.7", 지난해면 "2025.11.7" (목록 카드 "등록 11.7", 2026-11-09)
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const md = `${d.getMonth() + 1}.${d.getDate()}`;
  return d.getFullYear() === new Date().getFullYear() ? md : `${d.getFullYear()}.${md}`;
}

// 날짜: "2026-10-29T..." → "2026.10.29"
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}.${mm}.${dd}`;
}

// 마감 D-day: "D-4" / 하루가 안 남았으면 "오늘" / 지났으면 "마감" / 마감일이 없으면 "-" (2026-11-12 설문 상세 시안)
export function formatDday(closesAt: string | null): string {
  if (!closesAt) return "-";
  const ms = new Date(closesAt).getTime() - Date.now();
  if (ms <= 0) return "마감";
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  return days >= 1 ? `D-${days}` : "오늘";
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
