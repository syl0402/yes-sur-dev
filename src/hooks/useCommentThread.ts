// 댓글 묶음 상태 (커뮤니티 글 · 오늘의 질문 · 월드컵): 목록 · 보내기 · 익명 · 답글 대상 · 공감 · 지우기/신고
// 목록(Comments)과 화면 맨 아래 고정 입력칸(CommentComposer)이 같이 쓴다 (2026-11-14 커뮤니티 시안: 입력칸 아래 고정)
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { type Comment, type CommentTarget, fetchCanAnonymous } from "@/lib/community";
import { showActions, showConfirm } from "@/lib/confirm";
import { errorMessage } from "@/lib/errors";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

export type CommentList = { best: Comment[]; all: Comment[] };

export type CommentThread = ReturnType<typeof useCommentThread>;

export function useCommentThread(type: CommentTarget, id: number | null, onChanged?: () => void) {
  const [list, setList] = useState<CommentList | null>(null);
  const [sending, setSending] = useState(false);
  const [anonymous, setAnonymous] = useState(true);
  // 익명으로 쓸 수 있는 사람(학생)만 익명 버튼이 보인다
  const [canAnon, setCanAnon] = useState(false);
  // 답글을 다는 중인 원댓글 (없으면 새 댓글)
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  const load = useCallback(() => {
    if (id === null) return;
    supabase
      .rpc("get_comments", { p_type: type, p_id: id })
      .then(({ data }) => setList((data as CommentList | null) ?? { best: [], all: [] }));
  }, [type, id]);

  useEffect(load, [load]);
  useEffect(() => {
    fetchCanAnonymous().then(setCanAnon);
  }, []);

  // 댓글·답글 보내기 (성공하면 true). 답글 대상이 있으면 답글로
  const send = async (body: string) => {
    if (id === null || !body.trim() || sending) return false;
    setSending(true);
    const { error } = await supabase.rpc("create_comment", {
      p_type: type,
      p_id: id,
      p_body: body.trim(),
      p_parent_id: replyTo?.id ?? undefined,
      p_anonymous: anonymous,
    });
    setSending(false);
    if (error) {
      showNotice("댓글을 달지 못했어요", errorMessage(error));
      load();
      return false;
    }
    setReplyTo(null);
    load();
    onChanged?.();
    return true;
  };

  const like = async (c: Comment) => {
    const { error } = await supabase.rpc("like_comment", { p_comment_id: c.id });
    if (error) showNotice("공감하지 못했어요", errorMessage(error));
    load();
  };

  // ⋯: 내 댓글이면 삭제, 남의 댓글이면 신고
  const more = (c: Comment) =>
    showActions(
      "댓글",
      c.mine
        ? [
            {
              label: "삭제",
              destructive: true,
              onPress: () =>
                showConfirm({
                  title: "댓글을 지울까요?",
                  message: "",
                  okLabel: "삭제",
                  cancelLabel: "취소",
                  destructive: true,
                  onOk: async () => {
                    const { error } = await supabase.rpc("delete_comment", { p_comment_id: c.id });
                    if (error) showNotice("지우지 못했어요", errorMessage(error));
                    load();
                    onChanged?.();
                  },
                }),
            },
          ]
        : [
            {
              label: "신고",
              onPress: () => router.push({ pathname: "/report", params: { type: "comment", id: String(c.id) } }),
            },
          ],
    );

  return { list, sending, anonymous, setAnonymous, canAnon, replyTo, setReplyTo, send, like, more };
}
