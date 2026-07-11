import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// 노드 환경 — 최소한의 document/window/navigator 스텁으로 트래커를 검증한다.
function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function makeDom(pathname = "/", localStorage = memoryStorage()) {
  const listeners = {};
  const doc = {
    cookie: "",
    visibilityState: "visible",
    addEventListener: (ev, fn) => { (listeners[ev] ||= []).push(fn); },
  };
  const win = { location: { pathname }, localStorage };
  return { doc, win, listeners, localStorage };
}

let sent;

async function loadTrack({ pathname = "/", withBeacon = true, fetchOk = true, localStorage } = {}) {
  sent = [];
  const dom = makeDom(pathname, localStorage);
  const { doc, win, listeners } = dom;
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", win);
  vi.stubGlobal("navigator", withBeacon
    ? { sendBeacon: vi.fn((url, body) => { sent.push({ url, body, beacon: true }); return true; }) }
    : {});
  vi.stubGlobal("fetch", vi.fn(async (url, opts) => { sent.push({ url, body: opts?.body }); return { ok: fetchOk }; }));
  vi.resetModules();
  const mod = await import("../track.js");
  return { ...mod, ...dom };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("track", () => {
  it("sets bd_aid cookie and batches events on the flush interval", async () => {
    const { track, doc } = await loadTrack();
    track("page_view", { path: "/" });
    track("style_click", { entityType: "style", entityId: "ST-1" });
    expect(sent).toHaveLength(0); // 아직 큐
    await vi.advanceTimersByTimeAsync(5100);
    expect(sent).toHaveLength(1);
    expect(doc.cookie).toMatch(/bd_aid=[0-9a-f-]{36}/);
    const payload = JSON.parse(sent[0].body);
    expect(payload.events).toHaveLength(2);
    expect(payload.events[1]).toMatchObject({ type: "style_click", entityId: "ST-1" });
    expect(payload.events[1].id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("replaces a malformed analytics cookie instead of retrying an invalid session forever", async () => {
    const { track, doc } = await loadTrack();
    doc.cookie = "bd_aid=------------------------------------";
    track("page_view", { path: "/" });
    await vi.advanceTimersByTimeAsync(5100);
    expect(doc.cookie).toMatch(/^bd_aid=[0-9a-f]{8}-[0-9a-f-]{27}/i);
  });

  it("flushes immediately when the queue hits the batch cap", async () => {
    const { track } = await loadTrack();
    for (let i = 0; i < 25; i += 1) track("page_view", { path: `/p${i}` });
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0].body).events).toHaveLength(25);
  });

  it("flushes on visibilitychange → hidden via sendBeacon", async () => {
    const { track, doc, listeners } = await loadTrack();
    track("page_view", { path: "/" });
    doc.visibilityState = "hidden";
    for (const fn of listeners.visibilitychange || []) fn();
    expect(sent).toHaveLength(1);
    expect(sent[0].beacon).toBe(true);
  });

  it("falls back to fetch keepalive without sendBeacon", async () => {
    const { track } = await loadTrack({ withBeacon: false });
    track("page_view", { path: "/" });
    await vi.advanceTimersByTimeAsync(5100);
    expect(sent).toHaveLength(1);
    expect(sent[0].beacon).toBeUndefined();
  });

  it("ignores admin and gate paths", async () => {
    const { track } = await loadTrack({ pathname: "/admin/orders" });
    track("page_view", { path: "/admin/orders" });
    await vi.advanceTimersByTimeAsync(6000);
    expect(sent).toHaveLength(0);
  });

  it("persists a failed batch and retries it on the next page without changing event ids", async () => {
    const localStorage = memoryStorage();
    const first = await loadTrack({ fetchOk: false, localStorage });
    first.track("page_view", { path: "/diamonds" });
    await vi.advanceTimersByTimeAsync(5100);
    const failedId = JSON.parse(sent[0].body).events[0].id;
    expect(JSON.parse(localStorage.getItem("bd-activity-queue-v2"))).toHaveLength(1);

    const second = await loadTrack({ fetchOk: true, localStorage });
    await vi.advanceTimersByTimeAsync(0);
    expect(JSON.parse(sent[0].body).events[0].id).toBe(failedId);
    expect(localStorage.getItem("bd-activity-queue-v2")).toBeNull();
    expect(second).toBeTruthy();
  });
});
