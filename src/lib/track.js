// 방문자 행동 추적 — bd_aid 익명 쿠키 + 배치 전송(sendBeacon/fetch keepalive).
// fire-and-forget: 어떤 실패도 사용자 경험이나 콘솔에 드러나지 않는다.
// 데모 빌드(WITH_BACKOFFICE=false)와 어드민·게이트 화면에서는 완전 no-op.
import { WITH_BACKOFFICE } from "./flags.js";

const FLUSH_MS = 5000;
const MAX_QUEUE = 25;
const ENDPOINT = "/v1/activity";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1년

let queue = [];
let timer = null;

function cookieId() {
  const m = document.cookie.match(/(?:^|;\s*)bd_aid=([0-9a-f-]{36})/i);
  if (m) return m[1];
  const id = crypto.randomUUID();
  document.cookie = `bd_aid=${id}; max-age=${COOKIE_MAX_AGE}; path=/; samesite=lax`;
  return id;
}

function blockedPath() {
  const p = window.location.pathname;
  return p.startsWith("/bo-") || p.startsWith("/admin") || p.startsWith("/gate-");
}

function send(body) {
  try {
    const json = JSON.stringify(body);
    if (typeof navigator !== "undefined" && navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, json)) return;
    fetch(ENDPOINT, {
      method: "POST", credentials: "include", keepalive: true,
      headers: { "Content-Type": "application/json" }, body: json,
    }).catch(() => {});
  } catch { /* no-op */ }
}

export function flushNow() {
  if (queue.length === 0) return;
  try { cookieId(); } catch { queue = []; return; } // 쿠키를 못 심으면 세션 귀속 불가 — 버린다
  const events = queue.splice(0, MAX_QUEUE);
  send({ events });
}

function schedule() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; flushNow(); }, FLUSH_MS);
}

export function track(type, fields = {}) {
  if (!WITH_BACKOFFICE) return;
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (blockedPath()) return;
  queue.push({ type, ...fields });
  if (queue.length >= MAX_QUEUE) flushNow();
  else schedule();
}

if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushNow();
  });
}
