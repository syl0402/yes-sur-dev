// 화면에 보여줄 값의 형식을 맞춘다.

// 포인트: 1000 → "1,000P"
export function formatPoints(points: number): string {
  return `${points.toLocaleString("ko-KR")}P`;
}
