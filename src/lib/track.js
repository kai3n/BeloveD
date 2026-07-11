// 방문자 행동 추적 — bd_aid 익명 쿠키 + 내구성 있는 배치 전송.
// 전송이 끝나기 전에 페이지가 이동해도 localStorage 큐를 다음 페이지에서 재시도한다.
// 각 이벤트 UUID는 서버에서 멱등 처리되어 sendBeacon 후 재시도해도 중복 집계되지 않는다.
// 데모 빌드(WITH_BACKOFFICE=false)와 어드민·게이트 화면에서는 완전 no-op.
import { WITH_BACKOFFICE } from "./flags.js";

const FLUSH_MS = 5000;
const RETRY_MS = 10_000;
const MAX_QUEUE = 25;
const MAX_STORED = 100;
const ENDPOINT = "/v1/activity";
const STORAGE_KEY = "bd-activity-queue-v2";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1년

function storage() {
  try { return window.localStorage || null; } catch { return null; }
}

function loadQueue() {
  try {
    const saved = JSON.parse(storage()?.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((event) => event?.id && event?.type).slice(-MAX_STORED) : [];
  } catch { return []; }
}

let queue = typeof window === "undefined" ? [] : loadQueue();
let timer = null;
let sending = false;

function persistQueue() {
  try {
    const target = storage();
    if (!target) return;
    if (queue.length === 0) target.removeItem(STORAGE_KEY);
    else target.setItem(STORAGE_KEY, JSON.stringify(queue.slice(-MAX_STORED)));
  } catch { /* analytics must never block the product */ }
}

function cookieId() {
  const m = document.cookie.match(/(?:^|;\s*)bd_aid=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:;|$)/i);
  if (m) return m[1];
  const id = crypto.randomUUID();
  document.cookie = `bd_aid=${id}; max-age=${COOKIE_MAX_AGE}; path=/; samesite=lax`;
  return id;
}

function blockedPath() {
  const p = window.location.pathname;
  return p.startsWith("/bo-") || p.startsWith("/admin") || p.startsWith("/gate-");
}

function newEventId() {
  try { return crypto.randomUUID(); } catch {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const value = Math.floor(Math.random() * 16);
      return (char === "x" ? value : ((value & 0x3) | 0x8)).toString(16);
    });
  }
}

function schedule(delay = FLUSH_MS) {
  if (timer) return;
  timer = setTimeout(() => { timer = null; void flushNow(); }, delay);
}

export async function flushNow({ beacon = false } = {}) {
  if (queue.length === 0 || sending || blockedPath()) return false;
  try { cookieId(); } catch { queue = []; persistQueue(); return false; } // 쿠키를 못 심으면 세션 귀속 불가
  const events = queue.slice(0, MAX_QUEUE);
  const json = JSON.stringify({ events });

  if (beacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
    try {
      // 성공 반환은 브라우저 큐 수락만 뜻한다. 로컬 큐는 남겨 다음 페이지에서
      // fetch로 확인하고, 서버 event UUID 멱등성으로 중복을 제거한다.
      if (navigator.sendBeacon(ENDPOINT, json)) return true;
    } catch { /* fetch keepalive로 폴백 */ }
  }

  sending = true;
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST", credentials: "include", keepalive: true,
      headers: { "Content-Type": "application/json" }, body: json,
    });
    if (!response?.ok) throw new Error("activity delivery failed");
    const delivered = new Set(events.map((event) => event.id));
    queue = queue.filter((event) => !delivered.has(event.id));
    persistQueue();
    if (queue.length > 0) schedule(0);
    return true;
  } catch {
    persistQueue();
    schedule(RETRY_MS);
    return false;
  } finally {
    sending = false;
  }
}

export function track(type, fields = {}) {
  if (!WITH_BACKOFFICE) return;
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (blockedPath()) return;
  queue.push({ id: newEventId(), type, ...fields });
  if (queue.length > MAX_STORED) queue = queue.slice(-MAX_STORED);
  persistQueue();
  if (queue.length >= MAX_QUEUE) void flushNow();
  else schedule();
}

if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushNow({ beacon: true });
  });
  document.addEventListener("pagehide", () => { void flushNow({ beacon: true }); });
  if (queue.length > 0 && !blockedPath()) schedule(0);
}
