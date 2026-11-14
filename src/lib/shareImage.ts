// 화면 밖에 그려 둔 카드를 이미지(PNG)로 찍어서 OS 공유 시트(카톡 · 인스타 스토리 · 사진 저장)를 연다 (2026-11-14)
// 데이터 허브 결과 카드 · 커뮤니티 결과 공유 이미지가 같이 쓴다. 저장 크기: 정사각 1080×1080 · 스토리 1080×1920
import * as Sharing from "expo-sharing";
import type { ComponentRef, RefObject } from "react";
import type { View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { showNotice } from "@/lib/notice";

export const SHARE_WIDTH = 1080;

export type ShareShape = "square" | "story";

export async function shareViewAsImage(
  ref: RefObject<ComponentRef<typeof View> | null>,
  shape: ShareShape,
  dialogTitle: string,
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
    await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle });
  } catch {
    showNotice("이미지를 만들지 못했어요", "잠시 후 다시 시도해 주세요.");
  }
}
