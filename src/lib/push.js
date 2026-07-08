// 스태프 데스크톱 알림(웹푸시) 클라이언트 — 어드민 콘솔에서만 사용.
import { apiFetch } from "./api.js";

const SW_URL = "/sw-push.js";

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported() {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// "unsupported" | "denied" | "on" | "off"
export async function currentPushState() {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    const sub = reg && (await reg.pushManager.getSubscription());
    return sub ? "on" : "off";
  } catch { return "off"; }
}

export async function enablePush() {
  if (!pushSupported()) throw new Error("unsupported");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("denied");
  const { key, enabled } = await apiFetch("/admin/chat/push/key");
  if (!enabled || !key) throw new Error("server-disabled");
  const reg = await navigator.serviceWorker.register(SW_URL);
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  });
  await apiFetch("/admin/chat/push/subscribe", { method: "POST", body: { subscription: sub.toJSON() } });
  return "on";
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = reg && (await reg.pushManager.getSubscription());
  if (sub) {
    await apiFetch("/admin/chat/push/unsubscribe", { method: "POST", body: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  return "off";
}
