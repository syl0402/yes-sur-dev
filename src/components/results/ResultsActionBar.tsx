// 결과 화면 아래 고정 [출처 복사] [집계 CSV 받기] (2026-11-07 피드백: 가장 중요한 기능이라 어느 탭에서든 바로)
import * as Clipboard from "expo-clipboard";
import { StyleSheet } from "react-native";

import Button from "@/components/ui/Button";
import BottomBar from "@/components/ui/BottomBar";
import { aggregateCsv, exportCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import type { FullResults } from "@/lib/hub";
import { showNotice } from "@/lib/notice";

type Props = {
  full: FullResults;
  // 출처에 들어갈 설문 이름·주최
  title: string;
  host: string;
};

export default function ResultsActionBar({ full, title, host }: Props) {
  if (full.total === 0) return null;

  const copyCitation = async () => {
    const period = `${formatDate(full.started_at)}~${formatDate(full.ended_at)}`;
    const text = `출처: 옛썰 설문 「${title}」(${host}, 유효 응답 ${full.total}명, ${period} 조사)`;
    try {
      await Clipboard.setStringAsync(text);
      showNotice("출처를 복사했어요", text);
    } catch {
      showNotice("복사하지 못했어요", "잠시 후 다시 시도해 주세요.");
    }
  };

  // 집계 CSV (화면에 보이는 것과 같은 내용, 5명 미만 그룹은 숨김)
  const downloadCsv = () => exportCsv(title, "집계", aggregateCsv(full));

  return (
    <BottomBar>
      <Button title="출처 복사" variant="outline" onPress={copyCitation} style={styles.action} />
      <Button title="집계 CSV 받기" onPress={downloadCsv} style={styles.action} />
    </BottomBar>
  );
}

const styles = StyleSheet.create({
  action: {
    flex: 1,
  },
});
