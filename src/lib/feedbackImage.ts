// 의견 보내기 화면 캡처 첨부 (2026-11-14 마이 탭 시안 ⑨, 최대 3장 = FEEDBACK_IMAGE_MAX)
// 사진첩에서 고르기 → 저장소 feedback/<내 id>/<임의 이름>.jpg 에 올리기 → 경로를 send_feedback에 넘긴다
// 저장소는 비공개: 올린 본인과 운영자만 볼 수 있다 (20261114000008_feedback_image.sql)
import * as ImagePicker from "expo-image-picker";

import { canPickImage } from "@/lib/nativeFeatures";
import { supabase } from "@/lib/supabase";
import { makeRequestId } from "@/lib/surveyDraft";

const BUCKET = "feedback";

// 한 의견에 붙일 수 있는 캡처 수 (서버 send_feedback과 같음)
export const FEEDBACK_IMAGE_MAX = 3;

export type PickedImage = { uri: string; mimeType: string };

// 사진 고르기 (limit장까지, 취소하면 빈 목록). 사진첩 권한은 고르는 창이 알아서 묻는다
export async function pickFeedbackImages(limit: number): Promise<PickedImage[]> {
  if (!canPickImage || limit <= 0) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.6,
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
  });
  if (result.canceled) return [];
  return result.assets.slice(0, limit).map((a) => ({ uri: a.uri, mimeType: a.mimeType ?? "image/jpeg" }));
}

// 올리고 경로를 돌려준다 (실패하면 오류)
export async function uploadFeedbackImage(image: PickedImage): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("not_authenticated");
  const ext = image.mimeType === "image/png" ? "png" : image.mimeType === "image/webp" ? "webp" : "jpg";
  const path = `${uid}/${makeRequestId()}.${ext}`;
  const body = await (await fetch(image.uri)).arrayBuffer();
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: image.mimeType, upsert: false });
  if (error) throw error;
  return path;
}

// 잠깐 볼 수 있는 주소 (본인 · 운영자만 만들 수 있다)
export async function feedbackImageUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
  return data?.signedUrl ?? null;
}
