// 결과 출처 복사 (결과 화면 아래 고정 바 · 공유 시트가 같이 쓴다, 2026-11-14 묶음)
// "출처: 옛썰 설문 「제목」(주최, 유효 응답 n명, 2026.10.16~2026.10.23 조사)"
import * as Clipboard from "expo-clipboard";

import { formatDate } from "@/lib/format";
import type { FullResults } from "@/lib/hub";
import { showNotice } from "@/lib/notice";

export function citationText(full: FullResults, title: string, host: string): string {
  const period = `${formatDate(full.started_at)}~${formatDate(full.ended_at)}`;
  return `출처: 옛썰 설문 「${title}」(${host}, 유효 응답 ${full.total}명, ${period} 조사)`;
}

export async function copyCitation(full: FullResults, title: string, host: string) {
  const text = citationText(full, title, host);
  try {
    await Clipboard.setStringAsync(text);
    showNotice("출처를 복사했어요", text);
  } catch {
    showNotice("복사하지 못했어요", "잠시 후 다시 시도해 주세요.");
  }
}

// 카드용 짧은 기간 "10.16~10.23"
export function shortPeriod(full: FullResults): string {
  return `${formatDate(full.started_at).slice(5)}~${formatDate(full.ended_at).slice(5)}`;
}
