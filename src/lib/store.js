import { seed } from "./seed.js";
import { maskContacts } from "./masking.js";
import { assertClaimTransition, computeTier, salvageCredit, unitWholesale, metalQuote } from "./dealer.js";
import {
  MILESTONE_STAGES, publicDiamondView, customerOrderView, supplierTaskView,
  quoteCompute, reconcileDelta, randomQueryCode, tierForCarat,
} from "./ops.js";

const KEY = "lumina-db-v7"; // v7: 비주얼 커뮤니케이션 레이어 (chipCatalog, referenceMedia, 구조화 CAD 피드백)

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
    && Array.isArray(d.catalogItems) && d.settings?.goldSpotPerGram != null
    && Array.isArray(d.opsOrders) && Array.isArray(d.diamondPricing)
    && d.settings?.opsDepositRate != null
    && Array.isArray(d.chipCatalog)
  );
}

function db() {
  if (!cache) {
    storage.removeItem("lumina-db-v1");
    storage.removeItem("lumina-db-v2");
    storage.removeItem("lumina-db-v3");
    storage.removeItem("lumina-db-v4");
    storage.removeItem("lumina-db-v5");
    storage.removeItem("lumina-db-v6");
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
export function listVendors() { return db().users.filter((u) => u.role === "supplier"); }
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

// ---------- operations manual: intake & orders ----------
function audit(actor, entity, entityId, field, before, after) {
  db().auditLog.push({ id: nextId("aud"), actor, entity, entityId, field: field ?? null, before: before ?? null, after: after ?? null, at: now() });
}
export function listAudit(entityId) { return db().auditLog.filter((a) => a.entityId === entityId); }

function nextOrderId() {
  db().opsCounter += 1;
  return `DM-${String(db().opsCounter).padStart(6, "0")}`;
}
function nextSeqId(prefix, slice) {
  db().opsCounter += 1;
  return `${prefix}-${String(db().opsCounter).padStart(6, "0")}`;
}

export function listIntakes() { return [...db().intakes]; }
// 인테이크 제출 → Order 자동 생성 (매뉴얼 P1 자동화)
export function createIntake(form, customerId = null) {
  const intakeId = nextSeqId("IN");
  const orderId = nextOrderId();
  const status = !form.styleId ? "STYLE_SELECTION" : form.productLine === "solitaire" ? "STONE_SELECTION" : "QUOTATION";
  const intake = { id: intakeId, orderId, ...form, createdAt: now() };
  const order = {
    id: orderId, intakeId, customerId, customerName: form.name, styleId: form.styleId || null,
    status, owner: "Operations", queryCode: randomQueryCode(), selectedDiamondId: null,
    requiredDate: form.requiredDate || null, internalNotes: "", createdAt: now(),
  };
  db().intakes.push(intake);
  db().opsOrders.push(order);
  audit(customerId || "guest", "order", orderId, "create", null, status);
  persist();
  return { intake, order };
}

export function listOpsOrders(filter = {}) {
  let os = [...db().opsOrders];
  if (filter.customerId) os = os.filter((o) => o.customerId === filter.customerId);
  return os.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function getOpsOrder(id) { return db().opsOrders.find((o) => o.id === id) || null; }
export function getIntake(id) { return db().intakes.find((i) => i.id === id) || null; }
export function updateOpsOrder(id, patch, actor = "ops") {
  const o = getOpsOrder(id);
  for (const [k, v] of Object.entries(patch)) {
    if (o[k] !== v) { audit(actor, "order", id, k, o[k], v); o[k] = v; }
  }
  persist();
  return o;
}

// ---------- procurement & supplier ----------
export function listProcurements(filter = {}) {
  let ps = [...db().procurementReqs];
  if (filter.supplierId) ps = ps.filter((p) => p.supplierId === filter.supplierId);
  if (filter.orderId) ps = ps.filter((p) => p.orderId === filter.orderId);
  return ps.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function getProcurement(id) { return db().procurementReqs.find((p) => p.id === id) || null; }
export function createProcurement(orderId, { type, supplierId, dueDate, batchValidUntil, brief, metal, measurements }) {
  const pr = {
    id: nextSeqId("PR"), orderId, type, supplierId, dueDate, batchValidUntil: batchValidUntil || null,
    brief: brief || "", metal: metal || null, measurements: measurements || null,
    status: "open", result: null, createdAt: now(),
  };
  db().procurementReqs.push(pr);
  audit("ops", "procurement", pr.id, "create", null, type);
  persist();
  return pr;
}
// 서플라이어 화면용 — 고객 신원/Order ID 미노출
export function supplierTasks(supplierId) {
  return listProcurements({ supplierId }).map((pr) => {
    const order = getOpsOrder(pr.orderId);
    const style = order?.styleId ? getOpsStyle(order.styleId) : null;
    return supplierTaskView(pr, order, style);
  });
}
export function submitWeightLabor(prId, result) {
  const pr = getProcurement(prId);
  pr.result = result;
  pr.status = "submitted";
  audit(pr.supplierId, "procurement", prId, "result", null, "weightLabor");
  persist();
  return pr;
}
export function closeProcurement(prId) {
  const pr = getProcurement(prId);
  pr.status = "closed";
  persist();
}

// 서플라이어가 PR ID로 CAD/QC 제출 — Order ID는 내부에서만 해석
export function submitCadForPr(prId, fileUrl) {
  const pr = getProcurement(prId);
  const review = addCadVersion(pr.orderId, { fileUrl, supplierId: pr.supplierId });
  pr.status = "submitted";
  persist();
  return review;
}
export function submitQcForPr(prId, { video, cert, actualWeightG }) {
  const pr = getProcurement(prId);
  pr.result = { video, cert, actualWeightG };
  pr.status = "submitted";
  upsertMilestone(pr.orderId, "finalQcVideo", { status: "done", publishToClient: true, link: video || "" });
  upsertMilestone(pr.orderId, "igiInscriptionVerified", { status: "inProgress", publishToClient: false });
  audit(pr.supplierId, "procurement", prId, "result", null, "qc");
  persist();
  return pr;
}

// ---------- diamond candidates ----------
export function listCandidates(filter = {}) {
  let cs = [...db().diamondCands];
  if (filter.orderId) cs = cs.filter((c) => c.orderId === filter.orderId);
  if (filter.prId) cs = cs.filter((c) => c.prId === filter.prId);
  if (filter.publishedOnly) cs = cs.filter((c) => c.published);
  return cs;
}
export function getCandidate(id) { return db().diamondCands.find((c) => c.id === id) || null; }
export function submitCandidates(prId, candidates) {
  const pr = getProcurement(prId);
  const existing = listCandidates({ orderId: pr.orderId }).length;
  const created = candidates.map((cand, i) => ({
    id: `DIA-${pr.orderId}-${String(existing + i + 1).padStart(2, "0")}`,
    orderId: pr.orderId, prId,
    igiNo: cand.igiNo, shape: cand.shape, carat: cand.carat, color: cand.color, clarity: cand.clarity,
    growth: cand.growth, lab: cand.lab, proportions: cand.proportions || {},
    reportUrl: cand.reportUrl || "", image: cand.image || "", video: cand.video || "",
    colorTreatment: cand.colorTreatment || "disclosed", availability: "available",
    procurementCostUsd: cand.procurementCostUsd, supplierId: pr.supplierId,
    internalReview: null, internalNotes: "", published: false, customerPriceUsd: null,
    clientSelection: "none", locked: false, createdAt: now(),
  }));
  db().diamondCands.push(...created);
  pr.status = "submitted";
  audit(pr.supplierId, "procurement", prId, "candidates", null, String(created.length));
  persist();
  return created;
}
export function reviewCandidate(diaId, internalReview, notes) {
  const c = getCandidate(diaId);
  c.internalReview = internalReview;
  if (notes !== undefined) c.internalNotes = notes;
  persist();
  return c;
}
export function publishCandidate(diaId, customerPriceUsd) {
  const c = getCandidate(diaId);
  c.customerPriceUsd = customerPriceUsd;
  c.published = true;
  audit("ops", "diamond", diaId, "published", "false", "true");
  persist();
  return c;
}
export function unpublishCandidate(diaId) {
  const c = getCandidate(diaId);
  c.published = false;
  persist();
}
export function setCandidateAvailability(diaId, availability) {
  const c = getCandidate(diaId);
  c.availability = availability;
  if (availability === "sold") c.published = false; // 매뉴얼 §13: Sold는 즉시 비공개
  persist();
}
// 고객 선택 → Operations 락 → 주문 기록 + 마일스톤
export function selectCandidate(diaId, actor) {
  const c = getCandidate(diaId);
  c.clientSelection = "selected";
  audit(actor, "diamond", diaId, "clientSelection", "none", "selected");
  persist();
  return c;
}
export function lockCandidate(diaId) {
  const c = getCandidate(diaId);
  c.locked = true;
  const order = getOpsOrder(c.orderId);
  updateOpsOrder(order.id, { selectedDiamondId: diaId, status: "QUOTATION" });
  upsertMilestone(order.id, "diamondLocked", { status: "done", publishToClient: true, clientUpdate: c.id });
  return c;
}

// ---------- styles & specs ----------
export function listOpsStyles({ publishedOnly = false } = {}) {
  return db().opsStyles.filter((st) => !publishedOnly || (st.published && st.availableForSale));
}
export function getOpsStyle(id) { return db().opsStyles.find((st) => st.id === id) || null; }
export function saveOpsStyle(style) {
  const list = db().opsStyles;
  const i = list.findIndex((st) => st.id === style.id);
  if (i >= 0) list[i] = { ...list[i], ...style };
  else {
    const prefix = { ring: "RING", necklace: "NECK", earrings: "EARR", bangle: "BRAC" }[style.category] || "STYL";
    const count = list.filter((st) => st.category === style.category).length + 1;
    list.push({ published: false, availableForSale: false, mediaComplete: false, ...style, id: `${prefix}-${String(count).padStart(3, "0")}` });
  }
  persist();
}
export function listStyleSpecs(styleId) {
  return db().styleSpecs.filter((sp) => !styleId || sp.styleId === styleId);
}
export function saveStyleSpec(spec) {
  const list = db().styleSpecs;
  const i = list.findIndex((sp) => sp.id === spec.id);
  if (i >= 0) list[i] = { ...list[i], ...spec };
  else list.push({ status: "approved", ...spec, id: nextSeqId("SPEC") });
  persist();
}

// ---------- diamond pricing benchmark (9×7) ----------
export function getBenchmark() { return db().diamondPricing; }
export function benchmarkFor(shape, carat) {
  const tier = tierForCarat(carat);
  return db().diamondPricing.find((r) => r.shape === shape && r.tier === tier) || null;
}
export function setBenchmarkPrice(shape, tier, unitUsdPerCt) {
  const row = db().diamondPricing.find((r) => r.shape === shape && r.tier === tier);
  if (row) {
    audit("ops", "benchmark", `${shape}/${tier}`, "unitUsdPerCt", String(row.unitUsdPerCt), String(unitUsdPerCt));
    row.unitUsdPerCt = unitUsdPerCt;
    row.quoteDate = now().slice(0, 10);
    persist();
  }
}

// ---------- quotes ----------
export function listQuotes(orderId) { return db().quotes.filter((q) => q.orderId === orderId).sort((a, b) => b.version - a.version); }
export function createQuote(orderId, { estWeightG, metalRefUsdPerG, lossRatePct, nonMetalUsd, internal }) {
  const order = getOpsOrder(orderId);
  const dia = order.selectedDiamondId ? getCandidate(order.selectedDiamondId) : null;
  const bench = dia ? benchmarkFor(dia.shape, dia.carat) : null;
  const computed = quoteCompute({
    carat: dia?.carat || 0, benchmarkUsdPerCt: bench?.unitUsdPerCt || 0,
    multiplier: internal?.multiplier ?? db().settings.opsMultiplier,
    estWeightG, metalRefUsdPerG, lossRatePct, nonMetalUsd, depositRate: db().settings.opsDepositRate,
  });
  const version = listQuotes(orderId).length + 1;
  const quote = {
    id: `Q-${orderId}-V${version}`, orderId, version, status: "draft",
    estWeightG, metalRefUsdPerG, lossRatePct, nonMetalUsd,
    internal: internal || {}, // 원가·멀티플라이어 — 고객 미노출
    snapshot: { benchmarkUsdPerCt: bench?.unitUsdPerCt || 0, carat: dia?.carat || 0 }, // 벤치마크 변경이 과거 견적에 영향 없음
    ...computed, validUntil: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    leadDays: db().settings.productionLeadDays, acceptedAt: null, createdAt: now(),
  };
  db().quotes.push(quote);
  audit("ops", "quote", quote.id, "create", null, "draft");
  persist();
  return quote;
}
export function sendQuote(quoteId) {
  const q = db().quotes.find((x) => x.id === quoteId);
  q.status = "sent";
  createCustomerAction(q.orderId, { type: "quoteAcceptance", prompt: q.id, link: "" });
  persist();
  return q;
}
export function acceptQuote(quoteId, actor) {
  const q = db().quotes.find((x) => x.id === quoteId);
  q.status = "accepted";
  q.acceptedAt = now();
  audit(actor, "quote", quoteId, "status", "sent", "accepted");
  persist();
  return q;
}
// 디파짓 수령(증빙) → 주문 CAD 단계 + 마일스톤
export function markDepositReceived(orderId) {
  upsertMilestone(orderId, "depositReceived", { status: "done", publishToClient: true });
  updateOpsOrder(orderId, { status: "CAD" });
}
// 실중량 정산 → 잔금 가감
export function recordActualWeight(orderId, actualWeightG) {
  const q = listQuotes(orderId).find((x) => x.status === "accepted");
  const delta = reconcileDelta(q.estWeightG, actualWeightG, q.metalRefUsdPerG, q.lossRatePct);
  audit("ops", "quote", q.id, "balanceUsd", String(q.balanceUsd), String(q.balanceUsd + delta));
  q.actualWeightG = actualWeightG;
  q.balanceUsd += delta;
  q.totalUsd += delta;
  upsertMilestone(orderId, "actualMetalReconciled", { status: "done", publishToClient: true, clientUpdate: `${actualWeightG}g` });
  persist();
  return { quote: q, delta };
}

// ---------- milestones (스테이지당 1레코드) ----------
export function listMilestones(orderId) {
  const ms = db().milestones.filter((m) => m.orderId === orderId);
  return MILESTONE_STAGES.map((stage) => ms.find((m) => m.stage === stage)).filter(Boolean);
}
export function upsertMilestone(orderId, stage, patch) {
  let m = db().milestones.find((x) => x.orderId === orderId && x.stage === stage);
  if (!m) {
    m = {
      id: `M-${orderId}-${String(MILESTONE_STAGES.indexOf(stage) + 1).padStart(2, "0")}`,
      orderId, stage, status: "pending", clientUpdate: "", clientAction: "", link: "", publishToClient: false, at: now(),
    };
    db().milestones.push(m);
  }
  Object.assign(m, patch, { at: now() });
  persist();
  return m;
}

// ---------- CAD reviews (버전당 1레코드 — 히스토리 불변) ----------
export function listCadReviews(orderId) { return db().cadReviews.filter((c) => c.orderId === orderId).sort((a, b) => b.version - a.version); }
export function addCadVersion(orderId, { fileUrl, supplierId }) {
  const version = listCadReviews(orderId).length + 1;
  const review = {
    id: nextSeqId("CADR"), orderId, version, fileUrl,
    supplierUploadedAt: now(), internalReview: "", sentAt: null,
    decision: null, feedback: [], confirmedMeasurements: "", evidence: "", decidedAt: null,
  };
  db().cadReviews.push(review);
  upsertMilestone(orderId, "cadIssued", { status: "waitingClient", publishToClient: true, clientUpdate: `CAD V${version} ready for review`, link: fileUrl });
  createCustomerAction(orderId, { type: "cadReview", prompt: `CAD V${version}`, link: fileUrl });
  audit(supplierId || "supplier", "cad", review.id, "create", null, `V${version}`);
  persist();
  return review;
}
export function decideCad(reviewId, { decision, feedback, confirmedMeasurements }, actor) {
  const r = db().cadReviews.find((x) => x.id === reviewId);
  r.decision = decision;
  r.feedback = (feedback || []).map((f) => maskContacts(f)).filter(Boolean);
  r.confirmedMeasurements = confirmedMeasurements || "";
  r.decidedAt = now();
  audit(actor, "cad", reviewId, "decision", null, decision);
  if (decision === "approved") {
    upsertMilestone(r.orderId, "cadApproved", { status: "done", publishToClient: true, clientUpdate: `CAD V${r.version} approved` });
    upsertMilestone(r.orderId, "productionStarted", { status: "inProgress", publishToClient: true });
    updateOpsOrder(r.orderId, { status: "PRODUCTION" }, actor);
  }
  persist();
  return r;
}

// ---------- customer actions ----------
export function listCustomerActions(orderId, openOnly = false) {
  return db().customerActions.filter((a) => a.orderId === orderId && (!openOnly || a.status === "open"));
}
export function createCustomerAction(orderId, { type, prompt, link, dueDate }) {
  const action = { id: nextSeqId("CA"), orderId, type, prompt: prompt || "", link: link || "", dueDate: dueDate || null, status: "open", response: null, respondedAt: null, createdAt: now() };
  db().customerActions.push(action);
  persist();
  return action;
}
export function respondCustomerAction(actionId, response, actor) {
  const a = db().customerActions.find((x) => x.id === actionId);
  a.status = "done";
  a.response = maskContacts(response || "");
  a.respondedAt = now();
  audit(actor, "customerAction", actionId, "status", "open", "done");
  persist();
  return a;
}

// ---------- client portal (보안 프로젝션 적용) ----------
export function portalView(orderId, { customerId, queryCode } = {}) {
  const order = getOpsOrder(orderId);
  if (!order) return null;
  const authorized = (customerId && order.customerId === customerId) || (queryCode && order.queryCode === queryCode);
  if (!authorized) return null;
  const quote = listQuotes(orderId).find((q) => q.status === "sent" || q.status === "accepted") || null;
  return {
    order: customerOrderView(order),
    intake: getIntake(order.intakeId),
    style: order.styleId ? getOpsStyle(order.styleId) : null,
    candidates: listCandidates({ orderId, publishedOnly: true }).map(publicDiamondView),
    selected: order.selectedDiamondId ? publicDiamondView(getCandidate(order.selectedDiamondId)) : null,
    quote: quote && {
      id: quote.id, status: quote.status, estWeightG: quote.estWeightG,
      metalAmountUsd: quote.metalAmountUsd, nonMetalUsd: quote.nonMetalUsd, diamondAmountUsd: quote.diamondAmountUsd,
      totalUsd: quote.totalUsd, depositUsd: quote.depositUsd, balanceUsd: quote.balanceUsd,
      validUntil: quote.validUntil, leadDays: quote.leadDays,
    }, // 내부 원가·멀티플라이어 미포함
    milestones: listMilestones(orderId).filter((m) => m.publishToClient),
    cad: listCadReviews(orderId)[0] || null,
    actions: listCustomerActions(orderId, true),
  };
}

// ---------- daily checklist (매뉴얼 §12) ----------
export function dailyChecklist() {
  const orders = listOpsOrders();
  const soon = (d) => d && (new Date(d) - Date.now()) < 7 * 86400000;
  return {
    waitingClient: db().milestones.filter((m) => m.status === "waitingClient").map((m) => m.orderId),
    blocked: db().milestones.filter((m) => m.status === "blocked").map((m) => m.orderId),
    quotesExpiring: db().quotes.filter((q) => q.status === "sent" && soon(q.validUntil)).map((q) => q.id),
    lowCandidates: orders.filter((o) => o.status === "STONE_SELECTION" && listCandidates({ orderId: o.id, publishedOnly: true }).length < 3).map((o) => o.id),
    dueSoon: orders.filter((o) => !["DELIVERED", "ARCHIVED", "CANCELLED"].includes(o.status) && soon(o.requiredDate)).map((o) => o.id),
    openProcurements: db().procurementReqs.filter((p) => p.status === "open").map((p) => p.id),
  };
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

// ---------- visual comm layer: chip catalog ----------
export function listChips({ part } = {}) {
  return db().chipCatalog.filter((c) => c.active !== false && (!part || !c.parts || c.parts.includes(part)));
}
export function saveChip(chip) {
  const list = db().chipCatalog;
  const i = list.findIndex((c) => c.key === chip.key);
  if (i >= 0) list[i] = { ...list[i], ...chip };
  else list.push(chip);
  persist();
}

// ---------- misc ----------
export function getSettings() { return db().settings; }
export function updateSettings(patch) { Object.assign(db().settings, patch); persist(); }
