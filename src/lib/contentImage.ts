// 공개 사진 (2026-11-16 사진 기능 0단계). 저장소 content — 누구나 주소로 볼 수 있다 (20261116000002)
// 폴더마다 올릴 수 있는 사람이 정해져 있다: worldcup/ = 운영자만 (서버가 막는다)
// 비공개인 의견 캡처는 feedbackImage.ts
import * as ImagePicker from "expo-image-picker";

import { canPickImage } from "@/lib/nativeFeatures";
import { supabase } from "@/lib/supabase";
import { makeRequestId } from "@/lib/surveyDraft";

const BUCKET = "content";

export type PickedImage = { uri: string; mimeType: string };

// 사진 한 장 고르기 (취소하면 null). square = 정사각형으로 자르기 (월드컵 후보)
// 크기는 고르는 창의 화질 조절로 줄인다 (새 부품 없이. 저장소 한도 3MB)
export async function pickContentImage(square: boolean): Promise<PickedImage | null> {
  if (!canPickImage) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    // 아이폰 사진(HEIC)을 jpg로 바꿔서 받는다. 저장소는 jpg·png·webp만 받음 (2026-11-16)
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    quality: 0.7,
    allowsEditing: square,
    aspect: square ? [1, 1] : undefined,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const a = result.assets[0];
  return { uri: a.uri, mimeType: a.mimeType ?? "image/jpeg" };
}

// 올리고 경로를 돌려준다 (folder: "worldcup" 등). 실패하면 오류
export async function uploadContentImage(folder: string, image: PickedImage): Promise<string> {
  const ext = image.mimeType === "image/png" ? "png" : image.mimeType === "image/webp" ? "webp" : "jpg";
  const path = `${folder}/${makeRequestId()}.${ext}`;
  const body = await (await fetch(image.uri)).arrayBuffer();
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: image.mimeType, upsert: false });
  if (error) throw error;
  return path;
}

// 보여 줄 주소 (공개 저장소라 바로 만든다)
export function contentImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
