// 포인트 내역 목록: 카드 하나에 최신순으로 쭉 (2026-11-10)
// 줄: 이유 · 설문 제목 / 아래 날짜·시각 "2026.11.09 14:32" ……… 적립은 파랑 +10P, 사용은 진한 글씨 -50P
// (날짜별 묶기는 해 봤다가 피드백으로 뺌: 날짜·시각을 줄마다 보여 주는 게 낫다)
import Card from "@/components/ui/Card";
import ListRow, { rowsCard } from "@/components/ui/ListRow";
import { formatDate, formatPoints } from "@/lib/format";
import type { LedgerItem } from "@/lib/ledger";

export default function LedgerList({ items }: { items: LedgerItem[] }) {
  return (
    <Card style={rowsCard}>
      {items.map((item, i) => (
        <ListRow
          key={item.id}
          first={i === 0}
          title={item.title ? `${item.reason} · ${item.title}` : item.reason}
          sub={`${formatDate(item.createdAt)} ${formatClock(item.createdAt)}`}
          value={`${item.amount > 0 ? "+" : "-"}${formatPoints(Math.abs(item.amount))}`}
          valueTone={item.amount > 0 ? "primary" : "text"}
        />
      ))}
    </Card>
  );
}

// 시각 "14:32"
function formatClock(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
