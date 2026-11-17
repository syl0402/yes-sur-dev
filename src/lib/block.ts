// 사용자 차단 (2026-11-16 커뮤니티 ④, Play 사용자 제작 콘텐츠 정책 대비). 서버 함수 20261116000004_user_blocks.sql
// 글·댓글의 ⋯ → [이 사람 차단] → 그 사람 글·댓글이 나한테 안 보인다. 상대에게 알리지 않고, 내 정보 → 차단한 사용자에서 해제
import { showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

export type MyBlock = { id: number; context: string | null; created_at: string };

export function confirmBlock(type: "post" | "comment", id: number, onDone: () => void) {
  showConfirm({
    title: "이 사람을 차단할까요?",
    message: "이 사람의 글과 댓글이 더 이상 보이지 않아요. 상대에게는 알리지 않아요. 내 정보 → 차단한 사용자에서 풀 수 있어요.",
    okLabel: "차단",
    cancelLabel: "취소",
    destructive: true,
    onOk: async () => {
      const { error } = await supabase.rpc("block_author", { p_type: type, p_id: id });
      if (error) {
        showNotice("차단하지 못했어요", errorMessage(error));
        return;
      }
      showNotice("차단했어요", "이제 이 사람의 글과 댓글이 보이지 않아요.");
      onDone();
    },
  });
}
