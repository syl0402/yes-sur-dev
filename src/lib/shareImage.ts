// 화면 밖에 그려 둔 카드를 이미지(PNG)로 찍어서 OS 공유 시트(카톡 · 인스타 스토리 · 사진 저장)를 연다 (2026-11-14)
// 데이터 허브 결과 카드 · 커뮤니티 결과 공유 이미지가 같이 쓴다. 저장 크기: 정사각 1080×1080 · 스토리 1080×1920
import * as Sharing from "expo-sharing";
import type { ComponentRef, RefObject } from "react";
import type { View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

export const SHARE_WIDTH = 1080;

export type ShareShape = "square" | "story";

// 어떤 결과 카드인지 (웰컴 미션 "결과 카드 공유해 보기" 기록용, 서버 log_share)
export type ShareKind = "hub" | "balance" | "pick" | "worldcup" | "daily";

export async function shareViewAsImage(
  ref: RefObject<ComponentRef<typeof View> | null>,
  shape: ShareShape,
  dialogTitle: string,
  kind: ShareKind,
): Promise<void> {
  if (!ref.current) return;
  try {
    const uri = await captureRef(ref, {
      format: "png",
      quality: 1,
      result: "tmpfile",
      width: SHARE_WIDTH,
      height: shape === "story" ? (SHARE_WIDTH * 16) / 9 : SHARE_WIDTH,
    });
    // 공유 창을 열었다는 기록 (실제로 보냈는지는 앱이 알 수 없다). 실패해도 공유는 그대로
    supabase.rpc("log_share", { p_kind: kind }).then(() => undefined);
    await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle });
  } catch {
    showNotice("이미지를 만들지 못했어요", "잠시 후 다시 시도해 주세요.");
  }
}
