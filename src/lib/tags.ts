// 설문 태그 (2026-11-07). 카테고리(큰 분류 1개)와 따로, 세부 주제를 최대 survey_tag_max개.
// 태그 목록은 운영자가 DB(tags)에 정해 둔다. 붙이기는 서버 함수 set_survey_tags로만
import { supabase } from "@/lib/supabase";

export type Tag = { id: number; name: string };

// 지금 고를 수 있는 태그 (숨긴 태그는 RLS에서 빠진다)
export async function fetchTags(): Promise<Tag[]> {
  const { data } = await supabase.from("tags").select("id, name").order("sort_order");
  return data ?? [];
}

// "#연애"
export function formatTag(name: string): string {
  return `#${name}`;
}

// 걸러 보기: 고른 태그가 모두 붙어 있어야 보인다. 태그를 더할수록 좁혀진다 (2026-11-07 결정, 아무것도 안 골랐으면 전부)
export function matchesTags(itemTags: Tag[], picked: Tag[]): boolean {
  return picked.every((p) => itemTags.some((t) => t.id === p.id));
}

// 고른 태그에 더하기 (이미 있으면 그대로)
export function addTag(picked: Tag[], tag: Tag): Tag[] {
  return picked.some((p) => p.id === tag.id) ? picked : [...picked, tag];
}

// 화면 주소에 담기 (?tags=[{"id":1,"name":"연애"}]). 홈 카드 → 설문 탭으로 넘길 때
export function encodeTags(tags: Tag[]): string | undefined {
  return tags.length > 0 ? JSON.stringify(tags) : undefined;
}

export function decodeTags(raw: string | undefined): Tag[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as Tag[];
    return Array.isArray(list) ? list.filter((t) => typeof t?.id === "number" && typeof t?.name === "string") : [];
  } catch {
    return [];
  }
}
