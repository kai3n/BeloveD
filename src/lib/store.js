import { seed } from "./seed.js";
import { assertTransition } from "./statusMachine.js";
import { maskContacts } from "./masking.js";
import { assertClaimTransition, computeTier, salvageCredit, unitWholesale, metalQuote } from "./dealer.js";

const KEY = "lumina-db-v4"; // 스키마/시드 변경 시 버전업 (v4: 딜러 네트워크 도메인 추가)

// 테스트(node) 환경 폴백
const memoryStorage = (() => {
  let m = {};
  return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, removeItem: (k) => { delete m[k]; } };
})();
const storage = typeof localStorage !== "undefined" ? localStorage : memoryStorage;

let cache = null;
const listeners = new Set();

// 저장된 DB가 현재 스키마와 맞는지 검사 — 깨진/구버전 데이터면 재시드
function isValidDB(d) {
  return Boolean(
    d && Array.isArray(d.diamonds) && d.diamonds[0]?.priceUsd != null
    && d.settings?.shippingStages?.[0] === "production"
    && Array.isArray(d.catalogItems) && d.settings?.goldSpotPerGram != null
  );
}

function db() {
  if (!cache) {
    storage.removeItem("lumina-db-v1");
    storage.removeItem("lumina-db-v2");
    storage.removeItem("lumina-db-v3");
    let parsed = null;
    try {
      const raw = storage.getItem(KEY);
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    cache = isValidDB(parsed) ? parsed : seed();
    storage.setItem(KEY, JSON.stringify(cache));
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
    d.priceUsd = Math.round((d.priceUsd * (1 + percent / 100)) / 10) * 10;
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
    const totalUsd = (tpl?.basePriceUsd || 0) + (dia?.priceUsd || 0);
    order = {
      id: nextId("ord"), requestId: r.id, totalUsd,
      depositUsd: Math.round(totalUsd * db().settings.depositRate),
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
  const amount = kind === "deposit" ? order.depositUsd : order.totalUsd - order.depositUsd;
  db().payments.push({ id: nextId("pay"), orderId, kind, provider: "mock-pg", amount, currency: "USD", status: "paid", at: now() });
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

// ---------- dealer network (diamond_qc.pdf) ----------
export function listApplications() { return [...db().dealerApplications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
export function submitApplication(form) {
  const app = { id: nextId("app"), ...form, status: "pending", createdAt: now() };
  db().dealerApplications.push(app);
  persist();
  return app;
}
export function approveApplication(appId) {
  const app = db().dealerApplications.find((a) => a.id === appId);
  app.status = "approved";
  const user = { id: nextId("u"), email: app.email.toLowerCase(), name: app.bizName, role: "dealer", active: true };
  db().users.push(user);
  db().dealerProfiles.push({
    userId: user.id, tier: 2, city: app.city, permitNo: app.permitNo,
    resaleCertNo: app.resaleCertNo || "", active: true, tierOverride: null,
  });
  persist();
  return user;
}
export function rejectApplication(appId) {
  const app = db().dealerApplications.find((a) => a.id === appId);
  app.status = "rejected";
  persist();
}

export function getDealerProfile(userId) { return db().dealerProfiles.find((p) => p.userId === userId) || null; }
export function listDealers() {
  return db().users.filter((u) => u.role === "dealer").map((u) => ({ user: u, profile: getDealerProfile(u.id) }));
}
export function updateDealerProfile(userId, patch) {
  const p = getDealerProfile(userId);
  if (p) { Object.assign(p, patch); persist(); }
}
// 티어는 주문 이력에서 산정 (오버라이드 > 볼륨)
export function dealerTierInfo(userId, nowDate = new Date()) {
  const profile = getDealerProfile(userId);
  const orders = db().wholesaleOrders.filter((o) => o.dealerId === userId);
  const r = computeTier(orders, profile, db().settings, nowDate);
  if (r.tier !== profile.tier && !r.override) { profile.tier = r.tier; persist(); }
  return { ...r, profile };
}

export function listCatalog({ includeHidden = false } = {}) {
  return db().catalogItems.filter((c) => includeHidden || c.visible);
}
export function getCatalogItem(id) { return db().catalogItems.find((c) => c.id === id) || null; }
export function saveCatalogItem(item) {
  const list = db().catalogItems;
  const i = list.findIndex((c) => c.id === item.id);
  if (i >= 0) list[i] = { ...list[i], ...item };
  else list.push({ visible: true, resizable: true, ...item, id: nextId("c") });
  persist();
}

export function listWholesaleOrders(filter = {}) {
  let os = [...db().wholesaleOrders];
  if (filter.dealerId) os = os.filter((o) => o.dealerId === filter.dealerId);
  return os.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function createWholesaleOrder(dealerId, lines, shipTo) {
  const profile = getDealerProfile(dealerId);
  if (!profile?.resaleCertNo) throw new Error("resaleCertRequired"); // 첫 주문 전 resale cert 필수
  const settings = db().settings;
  const { tier } = dealerTierInfo(dealerId);
  const items = lines.filter((l) => l.qty > 0).map((l) => {
    const item = getCatalogItem(l.itemId);
    const metalUsd = metalQuote(item, settings.goldSpotPerGram, settings.goldPurity);
    const stoneUsd = tier === 1 ? item.stoneWholesaleT1 : item.stoneWholesaleT2;
    return { itemId: item.id, qty: l.qty, stoneUsd, metalUsd, unitUsd: stoneUsd + metalUsd };
  });
  if (items.length === 0) throw new Error("emptyOrder");
  const order = {
    id: nextId("wo"), dealerId, items, shipTo,
    goldSpotAtOrder: settings.goldSpotPerGram, // 주문 시점 견적 고정
    status: "PLACED", qcPhotos: [], trackingNo: null,
    totalUsd: items.reduce((sum, it) => sum + it.unitUsd * it.qty, 0), createdAt: now(),
  };
  db().wholesaleOrders.push(order);
  persist();
  return order;
}
const WHOLESALE_FLOW = { PLACED: ["QC_PASSED", "CANCELLED"], QC_PASSED: ["SHIPPED"], SHIPPED: ["DELIVERED"], DELIVERED: [], CANCELLED: [] };
export function transitionWholesale(orderId, to, extra = {}) {
  const o = db().wholesaleOrders.find((x) => x.id === orderId);
  if (!WHOLESALE_FLOW[o.status].includes(to)) throw new Error(`Invalid wholesale transition ${o.status} -> ${to}`);
  if (to === "QC_PASSED" && !(extra.qcPhotos?.length)) throw new Error("qcPhotosRequired"); // 개체별 QC 사진 필수
  if (extra.qcPhotos) o.qcPhotos = extra.qcPhotos;
  if (extra.trackingNo !== undefined) o.trackingNo = extra.trackingNo;
  o.status = to;
  persist();
  return o;
}

export function listWarrantyRegs(filter = {}) {
  let rs = [...db().warrantyRegs];
  if (filter.dealerId) rs = rs.filter((r) => r.dealerId === filter.dealerId);
  return rs.sort((a, b) => b.soldAt.localeCompare(a.soldAt));
}
export function registerWarranty(dealerId, { itemId, orderId, buyerName, buyerContact, soldAt }) {
  const until = new Date(soldAt);
  until.setMonth(until.getMonth() + db().settings.warrantyMonths);
  const reg = {
    id: nextId("wr"), dealerId, itemId, orderId: orderId || null,
    buyerName, buyerContact, soldAt, warrantyUntil: until.toISOString().slice(0, 10),
  };
  db().warrantyRegs.push(reg);
  persist();
  return reg;
}

export function listClaims(filter = {}) {
  let cs = [...db().claims];
  if (filter.dealerId) cs = cs.filter((c) => c.dealerId === filter.dealerId);
  return cs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function getClaim(id) { return db().claims.find((c) => c.id === id) || null; }
export function submitClaim(dealerId, { regId, defectType, desc, photos }) {
  const claim = {
    id: nextId("cl"), dealerId, regId, defectType,
    desc: maskContacts(desc || ""), photos: photos || [],
    status: "SUBMITTED", adminNote: "", salvage: null, createdAt: now(),
  };
  db().claims.push(claim);
  persist();
  return claim;
}
export function adjudicateClaim(claimId, decision, note) {
  const c = getClaim(claimId);
  if (decision === "approve") {
    assertClaimTransition(c.status, "APPROVED");
    c.status = "AWAITING_RETURN"; // 승인 = 교체 확정, 불량품 반환 대기 (선불 라벨)
  } else {
    assertClaimTransition(c.status, "DENIED");
    c.status = "DENIED";
  }
  c.adminNote = note || "";
  persist();
  return c;
}
export function receiveClaimReturn(claimId, { goldGrams, stoneToPool }) {
  const c = getClaim(claimId);
  assertClaimTransition(c.status, "RETURN_RECEIVED");
  c.status = "RETURN_RECEIVED";
  const creditUsd = salvageCredit(goldGrams, db().settings.goldSpotPerGram);
  c.salvage = { goldGrams, stoneToPool, creditUsd };
  db().salvageLedger.push({ id: nextId("sv"), claimId, goldGrams, stoneToPool, creditUsd, at: now() });
  persist();
  return c;
}
export function markClaimReplaced(claimId) {
  const c = getClaim(claimId);
  assertClaimTransition(c.status, "REPLACED");
  c.status = "REPLACED";
  persist();
  return c;
}
export function listSalvage() { return [...db().salvageLedger]; }

// ---------- misc ----------
export function listEvents(refId) { return db().statusEvents.filter((e) => e.refId === refId); }
export function getSettings() { return db().settings; }
export function updateSettings(patch) { Object.assign(db().settings, patch); persist(); }
