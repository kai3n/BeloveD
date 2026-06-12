import { seed } from "./seed.js";
import { assertTransition } from "./statusMachine.js";
import { maskContacts } from "./masking.js";

const KEY = "lumina-db-v1";

// 테스트(node) 환경 폴백
const memoryStorage = (() => {
  let m = {};
  return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, removeItem: (k) => { delete m[k]; } };
})();
const storage = typeof localStorage !== "undefined" ? localStorage : memoryStorage;

let cache = null;
const listeners = new Set();

function db() {
  if (!cache) {
    const raw = storage.getItem(KEY);
    cache = raw ? JSON.parse(raw) : seed();
    if (!raw) storage.setItem(KEY, JSON.stringify(cache));
  }
  return cache;
}
function persist() {
  storage.setItem(KEY, JSON.stringify(cache));
  listeners.forEach((fn) => fn());
}
const now = () => new Date().toISOString();

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function getDB() { return db(); }
export function resetDB() { cache = seed(); persist(); }

function nextId(prefix) {
  db().counter += 1;
  return `${prefix}-${db().counter}`;
}
function logEvent(refId, from, to, actorId) {
  db().statusEvents.push({ id: nextId("evt"), refId, from, to, actorId, at: now() });
}

// ---------- users ----------
export function findUserByEmail(email) {
  return db().users.find((u) => u.email === String(email).trim().toLowerCase()) || null;
}
export function getUser(id) { return db().users.find((u) => u.id === id) || null; }
export function addUser({ email, name, role = "customer" }) {
  const user = { id: nextId("u"), email: String(email).trim().toLowerCase(), name, role, active: true };
  db().users.push(user);
  persist();
  return user;
}
export function listVendors() { return db().users.filter((u) => u.role === "vendor"); }
export function setVendorActive(id, active) {
  const v = getUser(id);
  if (v) { v.active = active; persist(); }
}

// ---------- diamonds ----------
export function listDiamonds({ includeHidden = false } = {}) {
  return db().diamonds.filter((d) => includeHidden || d.visible);
}
export function getDiamond(id) { return db().diamonds.find((d) => d.id === id) || null; }
export function saveDiamond(diamond) {
  const list = db().diamonds;
  const i = list.findIndex((d) => d.id === diamond.id);
  if (i >= 0) list[i] = { ...list[i], ...diamond };
  else list.push({ media: [{ kind: "image", src: "/assets/lab-diamond-tweezers.png" }], visible: true, ...diamond, id: nextId("d") });
  persist();
}
export function adjustDiamondPrices(percent) {
  db().diamonds.forEach((d) => {
    d.priceKrw = Math.round((d.priceKrw * (1 + percent / 100)) / 1000) * 1000;
  });
  persist();
}

// ---------- templates ----------
export function listTemplates({ includeHidden = false } = {}) {
  return db().templates.filter((t) => includeHidden || t.visible);
}
export function getTemplate(id) { return db().templates.find((t) => t.id === id) || null; }
export function saveTemplate(tpl) {
  const list = db().templates;
  const i = list.findIndex((t) => t.id === tpl.id);
  if (i >= 0) list[i] = { ...list[i], ...tpl };
  else list.push({ media: [], visible: true, ...tpl, id: nextId("t") });
  persist();
}

// ---------- custom requests ----------
export function listRequests(filter = {}) {
  let rs = [...db().requests];
  if (filter.customerId) rs = rs.filter((r) => r.customerId === filter.customerId);
  if (filter.vendorId) rs = rs.filter((r) => r.vendorId === filter.vendorId);
  return rs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function getRequest(id) { return db().requests.find((r) => r.id === id) || null; }

export function createRequest({ customerId, templateId, diamondId, details }) {
  const id = nextId("req");
  const request = {
    id, code: `#${id.slice(4)}`, customerId, templateId, diamondId: diamondId || null,
    details: { ...details, notes: maskContacts(details?.notes || "") },
    status: "SUBMITTED", vendorId: null, createdAt: now(), assignedAt: null,
  };
  db().requests.push(request);
  logEvent(id, "DRAFT", "SUBMITTED", customerId);
  persist();
  return request;
}

// 상태 전이 공통 경로 + 주문 배송단계 동기화 (단계 키 — 라벨은 i18n 사전)
const STAGE_BY_STATUS = {
  IN_PRODUCTION: "production", QUALITY_CHECK: "qc", FINAL_PAYMENT_PAID: "ready",
  SHIPPED: "shipping", DELIVERED: "delivered", COMPLETED: "delivered",
};
export function transitionRequest(id, to, actor) {
  const r = getRequest(id);
  assertTransition(r.status, to, actor.role);
  logEvent(id, r.status, to, actor.id);
  r.status = to;
  const order = getOrderByRequest(id);
  if (order && STAGE_BY_STATUS[to]) order.shippingStage = STAGE_BY_STATUS[to];
  persist();
  return r;
}

export function assignVendor(requestId, vendorId, actor) {
  const r = getRequest(requestId);
  assertTransition(r.status, "VENDOR_ASSIGNED", actor.role);
  logEvent(requestId, r.status, "VENDOR_ASSIGNED", actor.id);
  r.status = "VENDOR_ASSIGNED";
  r.vendorId = vendorId;
  r.assignedAt = now();
  persist();
  return r;
}

// 벤더에게 보여줄 때 PII 제거 (핵심 익명성 규칙)
export function anonymizeForVendor(request) {
  const { customerId, ...rest } = request;
  return { ...rest, customerLabel: request.code };
}

// ---------- proposals & feedback ----------
export function listProposals(requestId) {
  return db().proposals.filter((p) => p.requestId === requestId).sort((a, b) => a.version - b.version);
}
export function addProposal(requestId, vendorId, { media, comment }) {
  const r = getRequest(requestId);
  assertTransition(r.status, "PROPOSAL_UPLOADED", "vendor");
  const proposal = {
    id: nextId("prop"), requestId, vendorId, version: listProposals(requestId).length + 1,
    media: media || [], comment: maskContacts(comment || ""), createdAt: now(),
  };
  db().proposals.push(proposal);
  logEvent(requestId, r.status, "PROPOSAL_UPLOADED", vendorId);
  r.status = "PROPOSAL_UPLOADED";
  persist();
  return proposal;
}
export function listFeedback(proposalId) {
  return db().feedback.filter((f) => f.proposalId === proposalId);
}
export function addFeedback(proposalId, { decision, choices, comment }, actor) {
  const proposal = db().proposals.find((p) => p.id === proposalId);
  const r = getRequest(proposal.requestId);
  const to = decision === "confirm" ? "CONFIRMED" : "REVISION_REQUESTED";
  assertTransition(r.status, to, actor.role);
  db().feedback.push({
    id: nextId("fb"), proposalId, customerId: actor.id, decision,
    choices: choices || [], comment: maskContacts(comment || ""), createdAt: now(),
  });
  logEvent(r.id, r.status, to, actor.id);
  r.status = to;
  let order = null;
  if (to === "CONFIRMED") {
    const tpl = getTemplate(r.templateId);
    const dia = r.diamondId ? getDiamond(r.diamondId) : null;
    const totalKrw = (tpl?.basePriceKrw || 0) + (dia?.priceKrw || 0);
    order = {
      id: nextId("ord"), requestId: r.id, totalKrw,
      depositKrw: Math.round(totalKrw * db().settings.depositRate),
      depositPaidAt: null, finalPaidAt: null, shippingStage: null, trackingNo: null, createdAt: now(),
    };
    db().orders.push(order);
  }
  persist();
  return { request: r, order };
}

// ---------- orders & payments ----------
export function listOrders() { return [...db().orders]; }
export function getOrderByRequest(requestId) {
  return db().orders.find((o) => o.requestId === requestId) || null;
}
export function payOrder(orderId, kind, actor) {
  const order = db().orders.find((o) => o.id === orderId);
  const r = getRequest(order.requestId);
  const to = kind === "deposit" ? "DEPOSIT_PAID" : "FINAL_PAYMENT_PAID";
  assertTransition(r.status, to, actor.role);
  const amount = kind === "deposit" ? order.depositKrw : order.totalKrw - order.depositKrw;
  db().payments.push({ id: nextId("pay"), orderId, kind, provider: "mock-pg", amount, currency: "KRW", status: "paid", at: now() });
  if (kind === "deposit") order.depositPaidAt = now();
  else order.finalPaidAt = now();
  logEvent(r.id, r.status, to, actor.id);
  r.status = to;
  if (STAGE_BY_STATUS[to]) order.shippingStage = STAGE_BY_STATUS[to];
  persist();
  return order;
}
export function listPayments(customerId) {
  const reqIds = new Set(listRequests({ customerId }).map((r) => r.id));
  const orderIds = new Set(db().orders.filter((o) => reqIds.has(o.requestId)).map((o) => o.id));
  return db().payments.filter((p) => orderIds.has(p.orderId));
}
export function updateShipping(orderId, { trackingNo }) {
  const order = db().orders.find((o) => o.id === orderId);
  if (trackingNo !== undefined) order.trackingNo = trackingNo;
  persist();
}

// ---------- production media ----------
export function listProductionMedia(requestId) {
  return db().productionMedia.filter((m) => m.requestId === requestId);
}
export function addProductionMedia(requestId, media) {
  db().productionMedia.push({ id: nextId("pm"), requestId, ...media, createdAt: now() });
  persist();
}

// ---------- misc ----------
export function listEvents(refId) { return db().statusEvents.filter((e) => e.refId === refId); }
export function getSettings() { return db().settings; }
export function updateSettings(patch) { Object.assign(db().settings, patch); persist(); }
