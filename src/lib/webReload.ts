// 웹 새 배포 직후 "옛 파일 못 찾음" 오류가 나면 페이지를 한 번 새로고침 (2026-11-22)
// - 배포하면 서버의 코드 파일 이름이 바뀐다. 웹을 열어 둔 사람이 화면을 옮기다 옛 파일을 찾으면
//   "Requiring unknown module" 또는 파일 대신 HTML이 와서 "Unexpected token '<'" 오류로 멈춘다 (Sentry 11/17)
// - 새로고침하면 새 버전을 받는다. 무한 반복을 막으려고 1분 안에는 다시 하지 않는다
// - 앱(안드로이드·아이폰)에서는 아무것도 안 한다
import { Platform } from "react-native";

const KEY = "yessur:chunk-reload-at";
const WAIT_MS = 60 * 1000;
const PATTERN = /Requiring unknown module|Unexpected token '<'|ChunkLoadError|Loading chunk|dynamically imported module/i;

function reloadOnce(message: string) {
  if (!PATTERN.test(message)) return;
  try {
    const last = Number(window.sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < WAIT_MS) return;
    window.sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // 저장소를 못 쓰는 브라우저(사생활 보호 모드 등)는 반복 위험이 있어 새로고침하지 않는다
    return;
  }
  window.location.reload();
}

export function initWebReload() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  window.addEventListener("error", (e) => reloadOnce(String(e.message ?? e.error?.message ?? "")));
  window.addEventListener("unhandledrejection", (e) => reloadOnce(String(e.reason?.message ?? e.reason ?? "")));
}
