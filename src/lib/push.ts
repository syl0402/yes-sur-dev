// 푸시 알림 (오늘의 질문, 2026-11-10)
// - 알림 부품(expo-notifications)은 필요할 때만 불러온다 → 부품이 없는 옛 APK(1.0.0)·웹에서는 아무것도 하지 않음
// - 권한은 앱을 켤 때 묻지 않고, 오늘의 질문에 처음 답한 직후 우리 안내 창 → 기기 허락 창 순서로 (허용률이 높음)
// - 서버(send_daily_push)가 매일 낮 12시에 아직 답하지 않은 사람에게 보낸다
import Constants from "expo-constants";
import { Platform } from "react-native";

import { canUseNotifications } from "@/lib/nativeFeatures";
import { supabase } from "@/lib/supabase";

// 서버가 보내는 알림의 안드로이드 채널 이름 (send_daily_push · send_mission_push의 channelId와 같아야 함)
const CHANNEL_ID = "daily";
const MISSION_CHANNEL_ID = "mission";
// 우리 안내 창을 이미 보여 줬는지 (이 폰 기준)
const ASKED_KEY = "push_asked_v1";

type NotificationsModule = typeof import("expo-notifications");

let cached: NotificationsModule | null = null;
async function load(): Promise<NotificationsModule | null> {
  if (!canUseNotifications) return null;
  cached ??= await import("expo-notifications");
  return cached;
}

// 앱이 켜질 때: 앱을 보고 있을 때도 알림이 뜨게 + 채널 만들기 + 이미 허락했으면 알림 주소 다시 등록 (주소가 바뀔 수 있음)
export async function initPush() {
  const N = await load();
  if (!N) return;
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  await ensureChannel(N);
  const { status } = await N.getPermissionsAsync();
  if (status === "granted") await saveToken(N);
}

// 오늘의 질문에 답한 뒤 우리 안내 창을 보여 줄지: 알림 가능 + 아직 안 물어봄 + 기기에서도 아직 안 정함
export async function shouldAskPush(): Promise<boolean> {
  const N = await load();
  if (!N) return false;
  if (readAsked()) return false;
  const { status } = await N.getPermissionsAsync();
  return status === "undetermined";
}

// 안내 창을 보여 줬다고 기록 (받든 안 받든 다시 묻지 않음. 내 정보에서 켤 수 있음)
export function markPushAsked() {
  try {
    localStorage.setItem(ASKED_KEY, "1");
  } catch {
    // 저장이 안 돼도 다음에 한 번 더 묻는 정도라 괜찮다
  }
}

function readAsked() {
  try {
    return localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return false;
  }
}

// 기기 허락 창 → 허락하면 알림 주소 등록. 허락했는지 돌려준다
export async function enablePush(): Promise<boolean> {
  const N = await load();
  if (!N) return false;
  await ensureChannel(N);
  const current = await N.getPermissionsAsync();
  const status = current.status === "granted" ? "granted" : (await N.requestPermissionsAsync()).status;
  if (status !== "granted") return false;
  await saveToken(N);
  return true;
}

// 이 폰의 알림 허락 상태 (2026-11-10, 오늘의 질문 팝업 "알림 받기" 줄)
// null = 알림을 못 받는 곳(웹·옛 APK) · blocked = 거절해서 허락 창이 다시 안 뜸 → 폰 설정으로 보내야 함
export async function pushPermission(): Promise<"granted" | "undetermined" | "denied" | "blocked" | null> {
  const N = await load();
  if (!N) return null;
  const { status, canAskAgain } = await N.getPermissionsAsync();
  if (status === "granted") return "granted";
  if (status === "denied" && !canAskAgain) return "blocked";
  return status === "denied" ? "denied" : "undetermined";
}

// 웰컴 미션 화면에서 "매일 미션 알림 받을까요?"를 물을지: 알림 가능 + 아직 안 물어봄 + 기기 허락 전 (2026-11-12)
// (이미 허락했으면 미션 알림은 기본 켬이라 묻지 않는다)
const MISSION_ASKED_KEY = "mission_push_asked_v1";

export async function shouldAskMissionPush(): Promise<boolean> {
  const N = await load();
  if (!N) return false;
  try {
    if (localStorage.getItem(MISSION_ASKED_KEY) === "1") return false;
  } catch {
    return false;
  }
  const { status } = await N.getPermissionsAsync();
  return status !== "granted";
}

export function markMissionPushAsked() {
  try {
    localStorage.setItem(MISSION_ASKED_KEY, "1");
  } catch {
    // 저장이 안 돼도 다음에 한 번 더 묻는 정도라 괜찮다
  }
}

// 로그아웃할 때: 이 기기로 내 알림이 가지 않게 주소를 지운다
export async function disablePushOnThisDevice() {
  const N = await load();
  if (!N) return;
  try {
    const token = await getToken(N);
    if (token) await supabase.rpc("unregister_push_token", { p_token: token });
  } catch {
    // 인터넷이 없으면 그냥 넘어간다 (다른 사람이 로그인하면 그 사람 것으로 바뀜)
  }
}

// 알림을 눌렀을 때 갈 화면을 넘겨준다 (앱이 꺼져 있다가 알림으로 켜진 경우도). 정리 함수를 돌려준다
export async function listenPushTaps(open: (url: string) => void): Promise<() => void> {
  const N = await load();
  if (!N) return () => {};
  const handle = (response: { notification: { request: { content: { data?: Record<string, unknown> } } } } | null) => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url === "string" && url.startsWith("/")) open(url);
  };
  const last = await N.getLastNotificationResponseAsync();
  if (last) {
    handle(last);
    await N.clearLastNotificationResponseAsync();
  }
  const sub = N.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}

// 안드로이드 13부터는 알림 주소를 받기 전에 채널이 있어야 한다
async function ensureChannel(N: NotificationsModule) {
  if (Platform.OS !== "android") return;
  await N.setNotificationChannelAsync(CHANNEL_ID, {
    name: "오늘의 질문",
    importance: N.AndroidImportance.DEFAULT,
  });
  // 웰컴 미션 (저녁 7시, 2026-11-12)
  await N.setNotificationChannelAsync(MISSION_CHANNEL_ID, {
    name: "웰컴 미션",
    importance: N.AndroidImportance.DEFAULT,
  });
}

async function getToken(N: NotificationsModule): Promise<string | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  try {
    return (await N.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    // 에뮬레이터 · 인터넷 없음 · Firebase 설정 전이면 실패한다
    return null;
  }
}

async function saveToken(N: NotificationsModule) {
  const token = await getToken(N);
  if (!token) return;
  await supabase.rpc("register_push_token", { p_token: token, p_platform: Platform.OS === "ios" ? "ios" : "android" });
}
