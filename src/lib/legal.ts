// 약관·개인정보처리방침 전문 (노션 공개 페이지). 원본 글은 docs/legal/
import { Linking } from "react-native";

import { showNotice } from "@/lib/notice";

// 노션 공개 페이지 (2026-10-30 게시). Google Play 개인정보처리방침·계정 삭제 URL로도 쓴다
export const LEGAL_URLS = {
  terms: "https://vaulted-request-542.notion.site/40907def8cbd80218caed27f52f8007f",
  privacy: "https://vaulted-request-542.notion.site/40907def8cbd802f9b65e1ea7dd7bc1b",
  deletion: "https://vaulted-request-542.notion.site/40907def8cbd8006b238ebc61ed8eaba",
};

export type LegalDoc = keyof typeof LEGAL_URLS;

// 전문을 브라우저로 연다. 주소가 아직 없으면 안내만
export function openLegal(doc: LegalDoc) {
  const url = LEGAL_URLS[doc];
  if (!url) {
    showNotice("준비 중이에요", "전문 페이지를 곧 올릴게요.");
    return;
  }
  Linking.openURL(url);
}
