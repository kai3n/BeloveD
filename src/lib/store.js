import { seed } from "./seed.js";
import { maskContacts } from "./masking.js";
import { validateAnnotation } from "./chips.js";
import { assertClaimTransition, computeTier, salvageCredit, unitWholesale, metalQuote } from "./dealer.js";
import {
  MILESTONE_STAGES, publicDiamondView, customerOrderView, supplierTaskView,
  quoteCompute, reconcileDelta, randomQueryCode, tierForCarat,
  autoBrief, candidateAutoPrice, isCandidateComplete, poolStoneMatches,
} from "./ops.js";

const KEY = "lumina-db-v12"; // v12: 무거운 이미지 webp 전환(시드 경로 .png→.webp) — 재시드 필요

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
    && d.settings?.defaultSupplierId != null
    && Array.isArray(d.poolDiamonds)
    && d.users?.some((u) => u.role === "supplier" && u.accessCode) // 벤더 접근 코드 스키마
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
    storage.removeItem("lumina-db-v7");
    storage.removeItem("lumina-db-v8");
    storage.removeItem("lumina-db-v9");
    storage.removeItem("lumina-db-v10");
    storage.removeItem("lumina-db-v11");
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
// 렌더 중 호출되는 lazy 정리(배치 만료 스윕)용 — 리스너 통지 없이 저장만 (렌더 중 setState 방지)
function persistQuiet() {
  storage.setItem(KEY, JSON.stringify(cache));
}
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const plusDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

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
// 벤더 접근 코드 — 비밀번호 대신 쓰는 무작위 코드 (추측 어렵게, 헷갈리는 글자 제외)
export function genAccessCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${pick(4)}-${pick(4)}`;
}
export function findUserByEmail(email) {
  return db().users.find((u) => u.email === String(email).trim().toLowerCase()) || null;
}
// 벤더 로그인용 — 코드로 유저 조회 (대소문자·공백 무시)
export function findUserByAccessCode(code) {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return null;
  return db().users.find((u) => u.accessCode && u.accessCode.toUpperCase() === c) || null;
}
export function getUser(id) { return db().users.find((u) => u.id === id) || null; }
export function addUser({ email, name, role = "customer" }) {
  const user = { id: nextId("u"), email: String(email).trim().toLowerCase(), name, role, active: true };
  // 벤더는 비밀번호 대신 접근 코드 — 발급 즉시 생성
  if (role === "supplier") user.accessCode = genAccessCode();
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
  else list.push({ media: [{ kind: "image", src: "/assets/lab-diamond-tweezers.webp" }], visible: true, ...diamond, id: nextId("d") });
  persist();
}
export function adjustDiamondPrices(percent) {
  db().diamonds.forEach((d) => {
    d.priceUsd = Math.round((d.priceUsd * (1 + percent / 100)) / 10) * 10;
  });
  persist();
}

// ---------- vendor diamond pool ----------
export function listPoolDiamonds({ supplierId, includeArchived = false } = {}) {
  return db().poolDiamonds.filter((s) =>
    (includeArchived || !s.archived) && (!supplierId || s.supplierId === supplierId));
}
export function getPoolDiamond(id) { return db().poolDiamonds.find((s) => s.id === id) || null; }
export function savePoolDiamond(stone) {
  const list = db().poolDiamonds;
  const i = stone.id ? list.findIndex((s) => s.id === stone.id) : -1;
  if (i >= 0) {
    list[i] = { ...list[i], ...stone, updatedAt: now() };
    persist();
    return list[i];
  }
  const created = {
    media: [], availability: "available", archived: false, proportions: {}, colorTreatment: "disclosed",
    reportUrl: "", ...stone, id: nextSeqId("POOL"), createdAt: now(), updatedAt: now(),
  };
  list.push(created);
  audit(stone.supplierId || "ops", "pool", created.id, "create", null, "available");
  persist();
  return created;
}
export function archivePoolDiamond(id, archived = true) {
  const s = getPoolDiamond(id);
  if (!s) return;
  s.archived = archived; s.updatedAt = now();
  persist();
}
export function setPoolAvailability(id, availability) {
  const s = getPoolDiamond(id);
  if (!s) return;
  s.availability = availability; s.updatedAt = now();
  persist();
}

// 고객 선호(prefs)에 맞는 available 풀 스톤 — 활성 벤더만, 캐럿 근접→원가 순, 캡 적용
export function matchPoolForOrder(prefs) {
  if (!prefs) return [];
  const s = db().settings;
  const opts = { caratUnder: s.poolCaratUnder ?? 0.05, caratOver: s.poolCaratOver ?? 0.4 };
  const limit = s.poolMatchLimit ?? 12;
  return db().poolDiamonds
    .filter((stone) => {
      if (stone.archived || stone.availability !== "available") return false;
      const owner = getUser(stone.supplierId);
      if (!owner || owner.active === false) return false;
      return poolStoneMatches(stone, prefs, opts);
    })
    .sort((a, b) =>
      Math.abs(a.carat - prefs.carat) - Math.abs(b.carat - prefs.carat) ||
      (a.procurementCostUsd || 0) - (b.procurementCostUsd || 0))
    .slice(0, limit);
}

// 매칭된 풀 스톤을 주문 후보(diamondCands)로 스냅샷 복제 — 완결+벤치마크면 자동가·공개
function autoMatchFromPool(order, intake) {
  const matches = matchPoolForOrder(intake.stonePrefs);
  const existing = listCandidates({ orderId: order.id }).length;
  const created = matches.map((pool, i) => {
    const image = (pool.media || []).find((m) => m.kind === "image")?.src || "";
    const video = (pool.media || []).find((m) => m.kind === "video")?.src || "";
    return {
      id: `DIA-${order.id}-${String(existing + i + 1).padStart(2, "0")}`,
      orderId: order.id, prId: null, poolDiamondId: pool.id,
      igiNo: pool.igiNo, shape: pool.shape, carat: pool.carat, color: pool.color, clarity: pool.clarity,
      growth: pool.growth, lab: pool.lab, proportions: pool.proportions || {}, reportUrl: pool.reportUrl || "",
      image, video, colorTreatment: pool.colorTreatment || "disclosed", availability: "available",
      procurementCostUsd: pool.procurementCostUsd, supplierId: pool.supplierId,
      internalReview: null, internalNotes: "", published: false, customerPriceUsd: null,
      clientSelection: "none", locked: false, createdAt: now(),
    };
  });
  db().diamondCands.push(...created);
  created.forEach((c) => {
    const bench = benchmarkFor(c.shape, c.carat);
    if (isCandidateComplete(c) && bench) {
      c.customerPriceUsd = candidateAutoPrice(bench.unitUsdPerCt, c.carat, db().settings.opsMultiplier);
      c.published = true;
      audit("auto", "diamond", c.id, "published", "false", "true");
    }
  });
  return created;
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
  // 레퍼런스는 즉시 벤더에게 전달(approved) — 문제 자료는 미디어 피드에서 사후 숨김 처리
  const referenceMedia = (form.referenceMedia || []).map((m) => ({
    id: nextSeqId("REF"), kind: m.kind || "image", src: m.src, status: "approved",
    annotations: (m.annotations || []).filter((a) => validateAnnotation(a, db().chipCatalog)),
  }));
  const intake = { id: intakeId, orderId, ...form, referenceMedia, createdAt: now() };
  const order = {
    id: orderId, intakeId, customerId, customerName: form.name, styleId: form.styleId || null,
    status, owner: "Operations", queryCode: randomQueryCode(), selectedDiamondId: null,
    requiredDate: form.requiredDate || null, internalNotes: "", createdAt: now(),
  };
  db().intakes.push(intake);
  db().opsOrders.push(order);
  audit(customerId || "guest", "order", orderId, "create", null, status);
  autoDispatchIntake(order, intake);
  persist();
  return { intake, order };
}

// ---------- 자동 발행 (어드민 최소 개입) ----------
// 벤더 자동 매칭: 스타일 담당 벤더 → 기본 벤더. 비활성/미설정이면 null (주문은 멈추지 않고 체크리스트 표시)
function routeSupplier(styleId) {
  const sid = (styleId && getOpsStyle(styleId)?.supplierId) || db().settings.defaultSupplierId;
  const v = sid ? getUser(sid) : null;
  return v && v.role === "supplier" && v.active !== false ? v.id : null;
}
// 주문 담당 벤더: 직전 태스크의 벤더 우선 (스톤 확정 후엔 그 벤더가 제작까지 담당)
function orderSupplier(orderId) {
  const last = listProcurements({ orderId })[0];
  return last?.supplierId || routeSupplier(getOpsOrder(orderId)?.styleId);
}
// 같은 유형의 열린 태스크가 있으면 중복 발행하지 않는다
function autoIssuePr(orderId, type, extra = {}) {
  if (listProcurements({ orderId }).some((p) => p.type === type && p.status === "open")) return null;
  const supplierId = extra.supplierId || orderSupplier(orderId);
  if (!supplierId) return null;
  return createProcurement(orderId, { dueDate: plusDays(db().settings.autoDueDays), ...extra, type, supplierId }, "auto");
}
// 인테이크 제출 즉시 벤더 태스크/견적 발행 — 매뉴얼 P1 자동화
function autoDispatchIntake(order, intake) {
  if (intake.productLine === "solitaire") {
    // 풀에서 자동 매칭 → 후보 생성. 매칭 0건이면 벤더 소싱 요청으로 폴백.
    const matched = autoMatchFromPool(order, intake);
    if (matched.length === 0) {
      autoIssuePr(order.id, "diamondCandidates", {
        supplierId: routeSupplier(order.styleId),
        batchValidUntil: plusDays(db().settings.batchValidDays), brief: autoBrief(intake),
      });
    }
  } else if (!tryAutoQuote(order.id)) {
    autoIssuePr(order.id, "weightLabor", {
      supplierId: routeSupplier(order.styleId), brief: autoBrief(intake), metal: intake.metal || null,
      measurements: Object.entries(intake.conditional || {}).map(([k, v]) => `${k}: ${v}`).join(", ") || null,
    });
  }
}
function findSpec(styleId, metal) {
  return db().styleSpecs.find((sp) => sp.styleId === styleId && sp.metal === metal && sp.status === "approved") || null;
}
// 스펙이 준비됐으면 어드민 없이 견적 생성·발송. 스펙이 없으면 false (weightLabor 경유 후 재시도)
export function tryAutoQuote(orderId) {
  const order = getOpsOrder(orderId);
  const intake = order ? getIntake(order.intakeId) : null;
  if (!order?.styleId || !intake) return false;
  if (listQuotes(orderId).some((q) => q.status === "sent" || q.status === "accepted")) return true; // 이미 진행중
  const spec = findSpec(order.styleId, intake.metal);
  if (!spec) return false;
  const dia = order.selectedDiamondId ? getCandidate(order.selectedDiamondId) : null;
  if (intake.productLine === "solitaire" && !dia) return false; // 다이아 락 이후 재시도
  const s = db().settings;
  const q = createQuote(orderId, {
    estWeightG: spec.estWeightG, metalRefUsdPerG: s.metalRefUsdPerG[intake.metal] || 85,
    lossRatePct: s.defaultLossRatePct, nonMetalUsd: (spec.laborUsd || 0) + (spec.materialsUsd || 0),
    internal: { diamondCostUsd: dia?.procurementCostUsd || 0, laborUsd: spec.laborUsd || 0, multiplier: s.opsMultiplier },
  });
  sendQuote(q.id);
  audit("auto", "quote", q.id, "autoSend", null, "sent");
  return true;
}

// 레퍼런스 검수 — 승인분만 벤더 브리프에 포함 (타인 디자인 도용·연락처 포함 이미지 차단)
export function reviewReferenceMedia(intakeId, refId, status, actor = "ops") {
  const m = getIntake(intakeId)?.referenceMedia?.find((r) => r.id === refId);
  if (!m) return null;
  audit(actor, "referenceMedia", refId, "status", m.status, status);
  m.status = status;
  persist();
  return m;
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
export function createProcurement(orderId, { type, supplierId, dueDate, batchValidUntil, brief, metal, measurements, diamondId }, actor = "ops") {
  const pr = {
    id: nextSeqId("PR"), orderId, type, supplierId, dueDate, batchValidUntil: batchValidUntil || null,
    brief: brief || "", metal: metal || null, measurements: measurements || null,
    diamondId: diamondId || null,
    status: "open", result: null, createdAt: now(),
  };
  db().procurementReqs.push(pr);
  audit(actor, "procurement", pr.id, "create", null, type);
  persist();
  return pr;
}
// 매뉴얼 §6.2: 배치 만료 시 태스크 종료 + 미판매 후보 자동 비공개 (큐/포털/체크리스트 진입 시 lazy 실행)
export function sweepExpiredBatches() {
  const t = today();
  let changed = false;
  db().procurementReqs.forEach((pr) => {
    if (pr.type !== "diamondCandidates" || !pr.batchValidUntil || pr.batchValidUntil >= t || pr.status === "closed") return;
    pr.status = "closed";
    listCandidates({ prId: pr.id }).forEach((c) => {
      if (!c.locked && c.published) c.published = false;
    });
    audit("auto", "procurement", pr.id, "status", "open", "closed");
    changed = true;
  });
  if (changed) persistQuiet();
}
// 서플라이어 화면용 — 고객 신원/Order ID 미노출
export function supplierTasks(supplierId) {
  sweepExpiredBatches();
  return listProcurements({ supplierId }).map((pr) => {
    const order = getOpsOrder(pr.orderId);
    const style = order?.styleId ? getOpsStyle(order.styleId) : null;
    const intake = order ? getIntake(order.intakeId) : null;
    // CAD 태스크에는 최신 minorRevision 리뷰(이미지+핀)를 브리프로 동봉 (숨김 처리된 버전 제외)
    const revision = pr.type === "cad" && order
      ? listCadReviews(order.id).find((c) => c.decision === "minorRevision" && !c.hidden) || null
      : null;
    // 재고확인엔 대상 다이아, CAD/QC엔 확정된 센터스톤 사양 동봉 (둘 다 안전 필드만 — 고객가 미노출)
    const diaId = pr.diamondId || (["cad", "qc"].includes(pr.type) ? order?.selectedDiamondId : null);
    const diamond = diaId ? getCandidate(diaId) : null;
    return supplierTaskView(pr, order, style, intake, revision, diamond);
  });
}
export function submitWeightLabor(prId, result) {
  const pr = getProcurement(prId);
  pr.result = result;
  pr.status = "submitted";
  audit(pr.supplierId, "procurement", prId, "result", null, "weightLabor");
  // 벤더 제출값으로 스펙 자동 등록 → 자동 견적 재시도 (어드민 손 거치지 않음)
  const order = getOpsOrder(pr.orderId);
  const intake = order ? getIntake(order.intakeId) : null;
  if (order?.styleId && intake && result.estWeightG && !findSpec(order.styleId, intake.metal)) {
    saveStyleSpec({
      styleId: order.styleId, metal: intake.metal, size: pr.measurements || "",
      centerStoneSpec: intake.productLine === "solitaire" ? "per order" : "none",
      estWeightG: Number(result.estWeightG), variancePct: 6, laborUsd: Number(result.laborUsd) || 0,
      materialsUsd: Number(result.meleeUsd) || 0, status: "approved", evidence: prId,
    });
  }
  if (order) tryAutoQuote(order.id);
  persist();
  return pr;
}
export function closeProcurement(prId) {
  const pr = getProcurement(prId);
  pr.status = "closed";
  persist();
}

// 서플라이어가 PR ID로 CAD/QC 제출 — Order ID는 내부에서만 해석
// CAD payload: 문자열(레거시) 또는 슬롯 배열 [{slot, kind, src}]
export function submitCadForPr(prId, payload) {
  const pr = getProcurement(prId);
  const args = typeof payload === "string" ? { fileUrl: payload } : { media: payload };
  const review = addCadVersion(pr.orderId, { ...args, supplierId: pr.supplierId });
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
  // 실중량 증빙 제출 즉시 잔금 자동 정산 (어드민 수동 정산 제거)
  if (actualWeightG && listQuotes(pr.orderId).some((q) => q.status === "accepted")) {
    recordActualWeight(pr.orderId, actualWeightG);
  }
  // 체크포인트 ③: 완성품 영상 → 고객 최종 컨펌 액션 (증거 보존)
  createCustomerAction(pr.orderId, { type: "finalConfirmation", prompt: "finalQc", link: video || "" });
  const o = getOpsOrder(pr.orderId);
  if (o.status === "PRODUCTION") updateOpsOrder(o.id, { status: "QC" }, pr.supplierId);
  audit(pr.supplierId, "procurement", prId, "result", null, "qc");
  persist();
  return pr;
}

// 어드민 터치포인트 ②: 잔금 입금 확인 → 벤더 발송 태스크 자동 발행
export function markBalanceReceived(orderId) {
  upsertMilestone(orderId, "balanceReceived", { status: "done", publishToClient: true });
  autoIssuePr(orderId, "ship", { brief: `Ship to: ${db().settings.shipToAddress}` });
  audit("ops", "order", orderId, "balance", null, "received");
  persist();
}
// 벤더 운송장 제출 → 배송 마일스톤 자동 갱신 + SHIPPING (고객 포털에 트래킹 표시)
export function submitShipment(prId, { trackingNo, shippedAt }) {
  const pr = getProcurement(prId);
  pr.result = { trackingNo, shippedAt: shippedAt || today() };
  pr.status = "submitted";
  upsertMilestone(pr.orderId, "sentDomesticWarehouse", { status: "done", publishToClient: true, clientUpdate: pr.result.shippedAt });
  upsertMilestone(pr.orderId, "oceanShipment", { status: "inProgress", publishToClient: true, clientUpdate: trackingNo || "" });
  updateOpsOrder(pr.orderId, { status: "SHIPPING" }, pr.supplierId);
  audit(pr.supplierId, "procurement", prId, "result", null, "shipped");
  persist();
  return pr;
}
// 어드민 터치포인트 ③: 실물 수령 확인 → 완료 처리
export function markOrderDelivered(orderId) {
  upsertMilestone(orderId, "oceanShipment", { status: "done", publishToClient: true });
  upsertMilestone(orderId, "deliveredArchived", { status: "done", publishToClient: true });
  updateOpsOrder(orderId, { status: "DELIVERED" });
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
  // 완결성+벤치마크 충족 후보는 벤치마크 자동가로 즉시 고객 공개 — 미달분은 보류(체크리스트 표시)
  created.forEach((c) => {
    const bench = benchmarkFor(c.shape, c.carat);
    if (isCandidateComplete(c) && bench) {
      c.customerPriceUsd = candidateAutoPrice(bench.unitUsdPerCt, c.carat, db().settings.opsMultiplier);
      c.published = true;
      audit("auto", "diamond", c.id, "published", "false", "true");
    }
  });
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
// 고객 선택 → 후보를 제출한 벤더에게 재고 확인 태스크 자동 발행
// (벤더 승인 시 자동 락, 품절 시 후보 제외 — submitStockConfirm)
export function selectCandidate(diaId, actor) {
  const c = getCandidate(diaId);
  // 매뉴얼 §13: 무효 후보(비공개·품절·배치 만료)는 스토어 레벨에서 선택 차단
  const pr = c.prId ? getProcurement(c.prId) : null;
  const expired = pr?.batchValidUntil && pr.batchValidUntil < today();
  if (!c.published || c.availability !== "available" || expired) throw new Error("notSelectable");
  c.clientSelection = "selected";
  audit(actor, "diamond", diaId, "clientSelection", "none", "selected");
  // 재선택 시 이전 미완료 재고확인이 큐에 쌓이지 않도록 정리
  listProcurements({ orderId: c.orderId }).forEach((p) => {
    if (p.type === "stockConfirm" && p.status === "open") p.status = "closed";
  });
  // 배치가 충분히 신선하면(만료까지 stockConfirmWithinDays 이상) 재고확인을 건너뛰고 바로 락 —
  // 벤더 라운드트립 하나를 제거한다. 만료 임박/배치 없음일 때만 §13 품절 방어로 벤더 확인을 요청.
  const fresh = pr?.batchValidUntil && pr.batchValidUntil >= plusDays(db().settings.stockConfirmWithinDays);
  if (fresh) {
    c.availability = "hold";
    audit("auto", "diamond", c.id, "stockConfirm", null, "autoFresh");
    lockCandidate(c.id);
  } else {
    createProcurement(c.orderId, { type: "stockConfirm", supplierId: c.supplierId, dueDate: plusDays(2), brief: c.igiNo, diamondId: c.id });
  }
  persist();
  return c;
}

// 벤더 재고 확인 응답: 재고 있음 → hold + 자동 락(QUOTATION), 품절 → sold·비공개·선택 초기화
export function submitStockConfirm(prId, available) {
  const pr = getProcurement(prId);
  const c = getCandidate(pr.diamondId);
  pr.status = "submitted";
  // 이중 판매 방지: 같은 풀 스톤을 다른 주문이 이미 확정했으면 '재고 있음'이라도 이 주문엔 품절 처리
  const pool = c.poolDiamondId ? getPoolDiamond(c.poolDiamondId) : null;
  const takenByOther = pool && pool.availability === "sold" && !c.locked;
  const effective = available && !takenByOther;
  pr.result = { available: effective, ...(takenByOther ? { takenByOther: true } : {}) };
  audit(pr.supplierId, "procurement", prId, "result", null, effective ? "inStock" : (takenByOther ? "takenByOther" : "soldOut"));
  if (effective) {
    c.availability = "hold";
    lockCandidate(c.id);
  } else {
    setCandidateAvailability(c.id, "sold"); // §13: 즉시 비공개 포함
    c.clientSelection = "none";
    audit(pr.supplierId, "diamond", c.id, "clientSelection", "selected", "none");
  }
  persist();
  return pr;
}
export function lockCandidate(diaId) {
  const c = getCandidate(diaId);
  // 이중 판매 방어: 풀 스톤을 다른 주문이 이미 가져갔으면 락하지 않는다
  if (c.poolDiamondId && !c.locked) {
    const taken = getPoolDiamond(c.poolDiamondId);
    if (taken && taken.availability === "sold") {
      setCandidateAvailability(c.id, "sold");
      c.clientSelection = "none";
      return null;
    }
  }
  c.locked = true;
  // 풀 스톤 소진 + 같은 스톤을 가리키는 다른 주문 후보 무효화 (이중 판매 방지)
  if (c.poolDiamondId) {
    const pool = getPoolDiamond(c.poolDiamondId);
    if (pool && pool.availability !== "sold") {
      pool.availability = "sold"; pool.updatedAt = now();
      audit("auto", "pool", pool.id, "availability", "available", "sold");
    }
    db().diamondCands.forEach((other) => {
      if (other.poolDiamondId === c.poolDiamondId && other.id !== c.id && !other.locked) {
        other.published = false;
        other.availability = "sold";
      }
    });
  }
  const order = getOpsOrder(c.orderId);
  updateOpsOrder(order.id, { selectedDiamondId: diaId, status: "QUOTATION" });
  upsertMilestone(order.id, "diamondLocked", { status: "done", publishToClient: true, clientUpdate: c.id });
  tryAutoQuote(order.id); // 스펙이 준비돼 있으면 어드민 없이 견적 즉시 발송
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
// 어드민 터치포인트 ①: 디파짓 입금 확인 → CAD 단계 + 벤더 CAD 태스크 자동 발행
export function markDepositReceived(orderId) {
  upsertMilestone(orderId, "depositReceived", { status: "done", publishToClient: true });
  updateOpsOrder(orderId, { status: "CAD" });
  const intake = getIntake(getOpsOrder(orderId)?.intakeId);
  autoIssuePr(orderId, "cad", {
    brief: intake ? autoBrief(intake) : "", metal: intake?.metal || null,
    measurements: Object.entries(intake?.conditional || {}).map(([k, v]) => `${k}: ${v}`).join(", ") || null,
  });
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
export function addCadVersion(orderId, { fileUrl, media, supplierId }) {
  const version = listCadReviews(orderId).length + 1;
  const review = {
    id: nextSeqId("CADR"), orderId, version,
    fileUrl: fileUrl || media?.[0]?.src || "",
    media: media || [],
    supplierUploadedAt: now(), internalReview: "", sentAt: null,
    decision: null, feedback: [], annotations: [], confirmedMeasurements: "", evidence: "", decidedAt: null,
  };
  db().cadReviews.push(review);
  upsertMilestone(orderId, "cadIssued", { status: "waitingClient", publishToClient: true, clientUpdate: `CAD V${version} ready for review`, link: review.fileUrl });
  createCustomerAction(orderId, { type: "cadReview", prompt: `CAD V${version}`, link: fileUrl });
  audit(supplierId || "supplier", "cad", review.id, "create", null, `V${version}`);
  persist();
  return review;
}
export function decideCad(reviewId, { decision, feedback, annotations, annotatedSrc, confirmedMeasurements }, actor) {
  const r = db().cadReviews.find((x) => x.id === reviewId);
  r.decision = decision;
  r.feedback = (feedback || []).map((f) => maskContacts(f)).filter(Boolean);
  r.annotations = (annotations || []).filter((a) => validateAnnotation(a, db().chipCatalog));
  r.annotatedSrc = annotatedSrc || ""; // 핀이 찍힌 정지 이미지 — 벤더에게 같은 캔버스로 전달
  r.confirmedMeasurements = confirmedMeasurements || "";
  r.decidedAt = now();
  r.feeAppliedUsd = 0;
  audit(actor, "cad", reviewId, "decision", null, decision);
  if (decision === "minorRevision") {
    // 무료 한도(freeMinorRevisions) 소진 후엔 디자인비를 잔금에 가산 — 무한 수정 루프 방지
    const prior = db().cadReviews.filter((c) => c.orderId === r.orderId && c.id !== r.id && c.decision === "minorRevision").length;
    if (prior >= db().settings.freeMinorRevisions) {
      const q = db().quotes.find((x) => x.orderId === r.orderId && x.status === "accepted");
      if (q) {
        const fee = db().settings.designChangeFeeUsd;
        audit(actor, "quote", q.id, "balanceUsd", String(q.balanceUsd), String(q.balanceUsd + fee));
        q.balanceUsd += fee;
        q.totalUsd += fee;
        r.feeAppliedUsd = fee;
      }
    }
    // 고객 핀이 그대로 벤더에게 재전달되도록 새 CAD 태스크 자동 발행 (supplierTaskView가 최신 리비전 동봉)
    autoIssuePr(r.orderId, "cad", { brief: `CAD V${r.version} minor revision — see pins` });
  }
  if (decision === "approved") {
    upsertMilestone(r.orderId, "cadApproved", { status: "done", publishToClient: true, clientUpdate: `CAD V${r.version} approved` });
    upsertMilestone(r.orderId, "productionStarted", { status: "inProgress", publishToClient: true });
    updateOpsOrder(r.orderId, { status: "PRODUCTION" }, actor);
    // 제작 완료 시점에 받을 QC 태스크를 미리 발행 (마감 = 제작 리드타임)
    autoIssuePr(r.orderId, "qc", {
      dueDate: plusDays(db().settings.productionLeadDays),
      brief: "Final QC video · certificate · actual weight evidence",
    });
  }
  persist();
  return r;
}

export function freeRevisionsLeft(orderId) {
  const used = db().cadReviews.filter((c) => c.orderId === orderId && c.decision === "minorRevision").length;
  return Math.max(0, db().settings.freeMinorRevisions - used);
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

// 최종 실물 컨펌 — "이 영상의 실물이 배송됩니다"에 대한 고객 동의. 분쟁 방어 증거.
export function confirmFinal(orderId, actor) {
  const a = db().customerActions.find((x) => x.orderId === orderId && x.type === "finalConfirmation" && x.status === "open");
  if (!a) return null;
  respondCustomerAction(a.id, "confirmed", actor);
  updateOpsOrder(orderId, { status: "BALANCE" }, actor);
  return a;
}

// ---------- client portal (보안 프로젝션 적용) ----------
export function portalView(orderId, { customerId, queryCode } = {}) {
  sweepExpiredBatches();
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
    cad: listCadReviews(orderId).find((c) => !c.hidden) || null, // 모니터링 숨김 버전 제외

    freeRevisionsLeft: freeRevisionsLeft(orderId),
    designChangeFeeUsd: db().settings.designChangeFeeUsd,
    finalAction: listCustomerActions(orderId, true).find((a) => a.type === "finalConfirmation") || null,
    actions: listCustomerActions(orderId, true),
  };
}

// ---------- daily checklist (매뉴얼 §12) ----------
function checklistCounts() {
  const orders = listOpsOrders();
  const soon = (d) => d && (new Date(d) - Date.now()) < 7 * 86400000;
  return {
    waitingClient: db().milestones.filter((m) => m.status === "waitingClient").map((m) => m.orderId),
    blocked: db().milestones.filter((m) => m.status === "blocked").map((m) => m.orderId),
    quotesExpiring: db().quotes.filter((q) => q.status === "sent" && soon(q.validUntil)).map((q) => q.id),
    lowCandidates: orders.filter((o) => o.status === "STONE_SELECTION" && listCandidates({ orderId: o.id, publishedOnly: true }).length < 3).map((o) => o.id),
    dueSoon: orders.filter((o) => !["DELIVERED", "ARCHIVED", "CANCELLED"].includes(o.status) && soon(o.requiredDate)).map((o) => o.id),
    openProcurements: db().procurementReqs.filter((p) => p.status === "open").map((p) => p.id),
    // 어드민 터치포인트: 입금 확인 대기 (자동화 흐름이 여기서만 어드민을 기다린다)
    depositWait: orders.filter((o) => o.status === "QUOTATION" && db().quotes.some((q) => q.orderId === o.id && q.status === "accepted")).map((o) => o.id),
    balanceWait: orders.filter((o) => o.status === "BALANCE" && !db().milestones.some((m) => m.orderId === o.id && m.stage === "balanceReceived" && m.status === "done")).map((o) => o.id),
    // 자동 공개 보류 후보 (완결성/벤치마크 미달) — 수동 가격 입력으로 공개 가능
    heldCandidates: db().diamondCands.filter((c) =>
      !c.published && !c.locked && c.availability === "available" && c.internalReview !== "excluded"
      && getProcurement(c.prId)?.status !== "closed"
    ).map((c) => c.id),
  };
}
export function dailyChecklist() {
  sweepExpiredBatches();
  return checklistCounts();
}

// ---------- 어드민 모니터링: 미디어 피드 (사전 검수 게이트 대신 사후 감시) ----------
export function mediaFeed(limit = 30) {
  const items = [];
  db().intakes.forEach((i) => (i.referenceMedia || []).forEach((m) => {
    items.push({ feedKind: "reference", id: m.id, refId: i.id, orderId: i.orderId, kind: m.kind, src: m.src, hidden: m.status === "hidden", at: i.createdAt });
  }));
  db().cadReviews.forEach((c) => {
    items.push({ feedKind: "cad", id: c.id, orderId: c.orderId, kind: c.fileUrl?.endsWith(".mp4") ? "video" : "image", src: c.fileUrl, hidden: Boolean(c.hidden), at: c.supplierUploadedAt });
  });
  db().procurementReqs.filter((p) => p.type === "qc" && p.result?.video).forEach((p) => {
    items.push({ feedKind: "qc", id: p.id, orderId: p.orderId, kind: "video", src: p.result.video, hidden: false, at: p.createdAt });
  });
  return items.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, limit);
}
// 문제 자료 숨김 — 상대방 미노출 + 해당 단계 재오픈(벤더 재제출 유도)
export function hideMedia(feedKind, id, refId) {
  if (feedKind === "reference") {
    reviewReferenceMedia(refId, id, "hidden", "ops");
    return;
  }
  if (feedKind === "cad") {
    const r = db().cadReviews.find((x) => x.id === id);
    r.hidden = true;
    if (!r.decision) {
      const pr = listProcurements({ orderId: r.orderId }).find((p) => p.type === "cad" && p.status === "submitted");
      if (pr) pr.status = "open"; // 미결정 버전이면 벤더가 다시 올리도록 재오픈
    }
    audit("ops", "cad", id, "hidden", "false", "true");
  } else if (feedKind === "qc") {
    const pr = getProcurement(id);
    pr.result = null;
    pr.status = "open";
    upsertMilestone(pr.orderId, "finalQcVideo", { status: "inProgress", publishToClient: false, link: "" });
    const a = db().customerActions.find((x) => x.orderId === pr.orderId && x.type === "finalConfirmation" && x.status === "open");
    if (a) a.status = "cancelled";
    audit("ops", "procurement", id, "qcHidden", null, "reopened");
  }
  persist();
}

// 역할별 "내 차례" 카운트 — 헤더 배지 (렌더 중 호출되므로 스윕 없이 읽기만)
export function pendingCount(user) {
  if (!user) return 0;
  if (user.role === "supplier") return listProcurements({ supplierId: user.id }).filter((p) => p.status === "open").length;
  if (user.role === "customer") {
    return listOpsOrders({ customerId: user.id }).reduce((n, o) => n + listCustomerActions(o.id, true).length, 0);
  }
  if (user.role === "admin") {
    const c = checklistCounts();
    return c.depositWait.length + c.balanceWait.length + c.heldCandidates.length;
  }
  return 0;
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
