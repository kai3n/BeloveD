import { seed } from "./seed.js";
import { styleSeedData } from "./styleSeedData.js";
import { maskContacts } from "./masking.js";
import { validateAnnotation } from "./chips.js";
import {
  MILESTONE_STAGES, publicDiamondView, customerOrderView, supplierTaskView,
  quoteCompute, reconcileDelta, randomQueryCode, tierForCarat,
  autoBrief, candidateAutoPrice, isCandidateComplete, poolStoneMatches,
} from "./ops.js";

const KEY = "lumina-db-v14"; // v14: 이미지 없는 CSV 스타일 제거 + 원본 미디어 재동기화

// 테스트(node) 환경 폴백
const memoryStorage = (() => {
  let m = {};
  return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, removeItem: (k) => { delete m[k]; } };
})();
const storage = typeof localStorage !== "undefined" ? localStorage : memoryStorage;

let cache = null;
const listeners = new Set();
const GENERATED_STYLE_MEDIA_PREFIX = "/assets/product-styles/";
const STYLE_MEDIA_AUDIT_VERSION = "original-product-media-v6";
const STYLE_COPY_AUDIT_VERSION = "seed-style-copy-v3";
const DIAMOND_DEPOSIT_FLOW_VERSION = "deposit-before-diamond-lock-v1";
const REMOVED_DUPLICATE_SEED_STYLE_IDS = new Set([
  "RING-008",
  "RING-010",
  "RING-011",
  "RING-012",
  "RING-013",
  "RING-014",
  "BAND-002",
]);
const STYLE_COPY_FIELDS = [
  "category",
  "subcategory",
  "supplierEvidence",
  "firstQuoteAt",
  "name",
  "detailLabel",
  "description",
  "flexibleText",
  "beforeProductionText",
];
const seedStyleMediaById = new Map(
  styleSeedData.map((style) => [
    style.id,
    {
      coverImage: style.coverImage,
      media: Array.isArray(style.media) ? style.media.map((item) => ({ ...item })) : [],
      mediaComplete: style.mediaComplete,
    },
  ]),
);
const seedStyleCopyById = new Map(
  styleSeedData.map((style) => [
    style.id,
    STYLE_COPY_FIELDS.reduce((copy, field) => ({ ...copy, [field]: style[field] }), {}),
  ]),
);
const seedStyleIds = new Set(styleSeedData.map((style) => style.id));

function cloneValue(value) {
  return value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value;
}

function sameValue(current, next) {
  return JSON.stringify(current ?? null) === JSON.stringify(next ?? null);
}

function hasGeneratedStyleMedia(style) {
  const media = Array.isArray(style?.media) ? style.media : [];
  return String(style?.coverImage || "").includes(GENERATED_STYLE_MEDIA_PREFIX)
    || media.some((item) => String(item?.src || "").includes(GENERATED_STYLE_MEDIA_PREFIX));
}

function hasLocalFallbackStyleMedia(style) {
  const media = Array.isArray(style?.media) ? style.media : [];
  return String(style?.coverImage || "").startsWith("/assets/lineup-")
    || media.some((item) => String(item?.src || "").startsWith("/assets/lineup-"));
}

function isRemovedSeedStyle(style) {
  return REMOVED_DUPLICATE_SEED_STYLE_IDS.has(style?.id)
    || (!seedStyleIds.has(style?.id) && (
      style?.supplierEvidence === "CSV style import"
      || hasGeneratedStyleMedia(style)
      || hasLocalFallbackStyleMedia(style)
    ));
}

function sameMediaSources(current = [], next = []) {
  const currentSources = (Array.isArray(current) ? current : []).map((item) => item?.src || "");
  const nextSources = (Array.isArray(next) ? next : []).map((item) => item?.src || "");
  return currentSources.length === nextSources.length
    && currentSources.every((src, index) => src === nextSources[index]);
}

function restoreOriginalStyleMedia(d, force = false) {
  if (!Array.isArray(d?.opsStyles)) return false;
  let changed = false;
  if (force) {
    const filtered = d.opsStyles.filter((style) => !isRemovedSeedStyle(style));
    if (filtered.length !== d.opsStyles.length) {
      d.opsStyles = filtered;
      changed = true;
    }
  }
  d.opsStyles = d.opsStyles.map((style) => {
    const seedMedia = seedStyleMediaById.get(style.id);
    const shouldRestore = force
      || hasGeneratedStyleMedia(style)
      || !sameMediaSources(style.media, seedMedia?.media);
    if (!seedMedia?.media?.length || !shouldRestore) return style;
    changed = true;
    return {
      ...style,
      coverImage: seedMedia.coverImage,
      media: seedMedia.media.map((item) => ({ ...item })),
      mediaComplete: seedMedia.mediaComplete,
    };
  });
  return changed;
}

function restoreSeedStyleCopy(d, force = false) {
  if (!force || !Array.isArray(d?.opsStyles)) return false;
  let changed = false;
  d.opsStyles = d.opsStyles.map((style) => {
    const seedCopy = seedStyleCopyById.get(style.id);
    if (!seedCopy) return style;
    const nextStyle = { ...style };
    STYLE_COPY_FIELDS.forEach((field) => {
      if (!sameValue(nextStyle[field], seedCopy[field])) {
        nextStyle[field] = cloneValue(seedCopy[field]);
        changed = true;
      }
    });
    return nextStyle;
  });
  return changed;
}

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

function migrateDB(d) {
  let changed = false;

  const shouldAuditStyleMedia = d?.settings?.styleMediaAuditVersion !== STYLE_MEDIA_AUDIT_VERSION;
  if (restoreOriginalStyleMedia(d, shouldAuditStyleMedia)) {
    changed = true;
  }
  if (shouldAuditStyleMedia && d?.settings) {
    d.settings.styleMediaAuditVersion = STYLE_MEDIA_AUDIT_VERSION;
    changed = true;
  }
  const shouldAuditStyleCopy = d?.settings?.styleCopyAuditVersion !== STYLE_COPY_AUDIT_VERSION;
  if (restoreSeedStyleCopy(d, shouldAuditStyleCopy)) {
    changed = true;
  }
  if (shouldAuditStyleCopy && d?.settings) {
    d.settings.styleCopyAuditVersion = STYLE_COPY_AUDIT_VERSION;
    changed = true;
  }

  // 리뷰 스토어 — 구버전 저장 DB에는 시드 데모 리뷰까지 주입 (빈 배열이면 홈 섹션이 통째로 숨는다)
  if (d && !Array.isArray(d.reviews)) {
    d.reviews = seed().reviews || [];
    changed = true;
  }

  // 결제 채널 설정 — 구버전 저장 DB에 시드 기본값 주입
  if (d?.settings && !d.settings.payment) {
    d.settings.payment = { zelle: "pay@beloved.co", venmo: "@BeloveD-Fine", note: "" };
    changed = true;
  }

  // v13 hotfix: operator-proxy diamond candidates are published for the
  // customer to choose, but older records marked them as already stock-confirmed.
  // That combination leaves the customer with a visible card and a disabled
  // Select button. Keep already-selected/locked stones intact.
  if (Array.isArray(d?.diamondCands)) {
    d.diamondCands.forEach((candidate) => {
      const order = d.opsOrders?.find((item) => item.id === candidate.orderId);
      const unchosenProxyCandidate = candidate.prId == null
        && candidate.published === true
        && candidate.stockConfirmed === true
        && candidate.clientSelection !== "selected"
        && !candidate.locked
        && !order?.selectedDiamondId;
      if (unchosenProxyCandidate) {
        candidate.stockConfirmed = false;
        changed = true;
      }
    });
  }

  // v14 hotfix: once a customer submits a diamond choice for stock
  // confirmation, the original "choose a diamond" action is no longer the
  // customer's turn. Older localStorage data left that action open, so admin
  // still showed "Customer turn" while the customer portal correctly said
  // BeloveD was confirming the stone.
  if (Array.isArray(d?.diamondCands) && Array.isArray(d?.customerActions)) {
    const submittedStockCheckOrders = new Set(
      d.diamondCands
        .filter((candidate) => candidate.clientSelection === "selected"
          && candidate.selectionSubmittedAt
          && !candidate.stockConfirmed
          && !candidate.locked)
        .map((candidate) => candidate.orderId),
    );
    d.customerActions.forEach((action) => {
      if (action.type !== "diamondSelection" || action.status !== "open" || !submittedStockCheckOrders.has(action.orderId)) return;
      action.status = "done";
      action.decision = "submitted";
      action.response = "submitted";
      action.respondedAt = action.respondedAt || new Date().toISOString();
      changed = true;
    });
    submittedStockCheckOrders.forEach((orderId) => {
      let milestone = d.milestones?.find((item) => item.orderId === orderId && item.stage === "diamondLocked");
      if (!Array.isArray(d.milestones)) d.milestones = [];
      if (!milestone) {
        milestone = {
          id: `M-${orderId}-${String(MILESTONE_STAGES.indexOf("diamondLocked") + 1).padStart(2, "0")}`,
          orderId,
          stage: "diamondLocked",
          status: "pending",
          clientUpdate: "",
          clientAction: "",
          link: "",
          publishToClient: false,
          at: new Date().toISOString(),
        };
        d.milestones.push(milestone);
      }
      if (!["done", "inProgress"].includes(milestone.status)) {
        milestone.status = "inProgress";
        milestone.publishToClient = false;
        milestone.clientUpdate = milestone.clientUpdate || "Customer selection submitted; confirming stock.";
        milestone.at = new Date().toISOString();
        changed = true;
      }
    });
  }

  if (d?.settings?.diamondDepositFlowVersion !== DIAMOND_DEPOSIT_FLOW_VERSION
    && Array.isArray(d?.diamondCands)
    && Array.isArray(d?.opsOrders)) {
    d.opsOrders.forEach((order) => {
      if (order.selectedDiamondId) return;
      const submitted = d.diamondCands.find((candidate) => candidate.orderId === order.id
        && candidate.clientSelection === "selected"
        && candidate.selectionSubmittedAt
        && candidate.availability === "available"
        && candidate.published !== false);
      if (!submitted) return;

      if (order.status === "STONE_SELECTION") {
        order.status = "QUOTATION";
        changed = true;
      }

      d.procurementReqs
        ?.filter((pr) => pr.orderId === order.id && pr.type === "stockConfirm" && pr.status === "open")
        .forEach((pr) => {
          pr.status = "closed";
          pr.result = { skipped: "depositBeforeDiamondLock" };
          changed = true;
        });

      d.customerActions
        ?.filter((action) => action.orderId === order.id && action.type === "diamondSelection" && action.status === "open")
        .forEach((action) => {
          action.status = "done";
          action.decision = "submitted";
          action.response = "submitted";
          action.respondedAt = action.respondedAt || new Date().toISOString();
          changed = true;
        });

      if (!Array.isArray(d.milestones)) d.milestones = [];
      let milestone = d.milestones.find((item) => item.orderId === order.id && item.stage === "diamondLocked");
      if (!milestone) {
        milestone = {
          id: `M-${order.id}-${String(MILESTONE_STAGES.indexOf("diamondLocked") + 1).padStart(2, "0")}`,
          orderId: order.id,
          stage: "diamondLocked",
          status: "waitingClient",
          clientUpdate: "Diamond selected; deposit required to lock it.",
          clientAction: "",
          link: "",
          publishToClient: false,
          at: new Date().toISOString(),
        };
        d.milestones.push(milestone);
        changed = true;
      } else if (milestone.status !== "done") {
        milestone.status = "waitingClient";
        milestone.publishToClient = false;
        milestone.clientUpdate = "Diamond selected; deposit required to lock it.";
        milestone.at = new Date().toISOString();
        changed = true;
      }

      if (!tryAutoQuote(order.id)) {
        const intake = d.intakes?.find((item) => item.orderId === order.id);
        autoIssuePr(order.id, "weightLabor", {
          brief: intake ? autoBrief(intake) : "",
          metal: intake?.metal || null,
          measurements: Object.entries(intake?.conditional || {}).map(([k, v]) => `${k}: ${v}`).join(", ") || null,
        });
      }
    });
    d.settings.diamondDepositFlowVersion = DIAMOND_DEPOSIT_FLOW_VERSION;
    changed = true;
  }

  return changed;
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
    storage.removeItem("lumina-db-v12");
    storage.removeItem("lumina-db-v13");
    let parsed = null;
    try {
      const raw = storage.getItem(KEY);
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    cache = isValidDB(parsed) ? parsed : seed();
    migrateDB(cache);
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
const MAX_ORDER_MEDIA = 5;
export const ORDER_MESSAGE_CHANNELS = ["web", "instagram", "threads", "usCommunity", "cnCommunity"];

function mediaKindFromSrc(src) {
  const s = String(src || "");
  return s.startsWith("data:video/") || /\.(mp4|webm|mov)(\?|#|$)/i.test(s) ? "video" : "image";
}

function normalizeOrderMedia(media = []) {
  return (Array.isArray(media) ? media : [])
    .filter((m) => m?.src)
    .slice(0, MAX_ORDER_MEDIA)
    .map((m) => ({
      kind: m.kind || mediaKindFromSrc(m.src),
      src: m.src,
      ...(m.slot ? { slot: m.slot } : {}),
      ...(m.label ? { label: maskContacts(m.label) } : {}),
      ...(m.name ? { name: maskContacts(m.name) } : {}),
      ...(m.size ? { size: m.size } : {}),
      ...(m.originalSize ? { originalSize: m.originalSize } : {}),
      ...(m.width ? { width: m.width } : {}),
      ...(m.height ? { height: m.height } : {}),
      ...(m.optimized ? { optimized: true } : {}),
      ...(m.transient ? { transient: true } : {}),
    }));
}

function normalizeActionResponse(response) {
  if (response && typeof response === "object" && !Array.isArray(response)) {
    const decision = response.decision || response.status || "submitted";
    const reason = maskContacts(response.reason || response.feedback || "");
    const value = maskContacts(response.value || response.response || reason || decision);
    return {
      status: decision === "rejected" ? "rejected" : "done",
      decision,
      value,
      reason,
      attachments: normalizeOrderMedia(response.attachments || response.media || []),
    };
  }
  const value = maskContacts(response || "");
  return {
    status: "done",
    decision: value || "submitted",
    value,
    reason: "",
    attachments: [],
  };
}

function normalizeMessageChannel(channel) {
  return ORDER_MESSAGE_CHANNELS.includes(channel) ? channel : "web";
}

function normalizeActorRole(role) {
  return ["customer", "ops", "system"].includes(role) ? role : "customer";
}

function ensureMessagingCollections() {
  const d = db();
  let changed = false;
  if (!Array.isArray(d.conversations)) {
    d.conversations = [];
    changed = true;
  }
  if (!Array.isArray(d.conversationMessages)) {
    d.conversationMessages = [];
    changed = true;
  }
  if (changed) persistQuiet();
}

function publicConversationMessage(m) {
  return {
    id: m.id,
    orderId: m.orderId,
    conversationId: m.conversationId,
    channel: m.channel,
    actorRole: m.actorRole,
    body: m.body,
    attachments: m.attachments || [],
    sourceLabel: m.sourceLabel || "",
    createdAt: m.createdAt,
  };
}

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
export function deleteDiamond(id) {
  const list = db().diamonds;
  const i = list.findIndex((d) => d.id === id);
  if (i >= 0) {
    list.splice(i, 1);
    persist();
  }
}
export function adjustDiamondPrices(percent) {
  db().diamonds.forEach((d) => {
    d.priceUsd = Math.round((d.priceUsd * (1 + percent / 100)) / 10) * 10;
  });
  persist();
}

// ---------- vendor diamond pool (internal helpers — no exported surface) ----------
function getPoolDiamond(id) { return db().poolDiamonds.find((s) => s.id === id) || null; }

// 고객 선호(prefs)에 맞는 available 풀 스톤 — 활성 벤더만, 캐럿 근접→원가 순, 캡 적용
function matchPoolForOrder(prefs) {
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

// 풀 스톤 → 주문 후보 스냅샷 (autoMatchFromPool·submitPoolCandidates 공용)
function poolStoneToCandidate(pool, orderId, seq, prId = null) {
  const media = normalizeOrderMedia(pool.media || []);
  const image = media.find((m) => m.kind === "image")?.src || "";
  const video = media.find((m) => m.kind === "video")?.src || "";
  const c = {
    id: `DIA-${orderId}-${String(seq).padStart(2, "0")}`,
    orderId, prId, poolDiamondId: pool.id,
    igiNo: pool.igiNo, shape: pool.shape, carat: pool.carat, color: pool.color, clarity: pool.clarity,
    growth: pool.growth, lab: pool.lab, proportions: pool.proportions || {}, reportUrl: pool.reportUrl || "",
    image, video, media, clientNote: "", colorTreatment: pool.colorTreatment || "disclosed", availability: "available",
    procurementCostUsd: pool.procurementCostUsd, supplierId: pool.supplierId,
    internalReview: null, internalNotes: "", published: false, customerPriceUsd: null,
    clientSelection: "none", stockConfirmed: false, locked: false, createdAt: now(),
  };
  const bench = benchmarkFor(c.shape, c.carat);
  if (isCandidateComplete(c) && bench) {
    c.customerPriceUsd = candidateAutoPrice(bench.unitUsdPerCt, c.carat, db().settings.opsMultiplier);
    c.published = true;
    audit("auto", "diamond", c.id, "published", "false", "true");
  }
  return c;
}

// 매칭된 풀 스톤을 주문 후보(diamondCands)로 스냅샷 복제 — 완결+벤치마크면 자동가·공개
function autoMatchFromPool(order, intake) {
  const matches = matchPoolForOrder(intake.stonePrefs);
  const existing = listCandidates({ orderId: order.id }).length;
  const created = matches.map((pool, i) => poolStoneToCandidate(pool, order.id, existing + i + 1, null));
  db().diamondCands.push(...created);
  return created;
}


// ---------- operations manual: intake & orders ----------
function audit(actor, entity, entityId, field, before, after) {
  db().auditLog.push({ id: nextId("aud"), actor, entity, entityId, field: field ?? null, before: before ?? null, after: after ?? null, at: now() });
}
export function listAudit(entityId) { return db().auditLog.filter((a) => a.entityId === entityId); }

export function listOrderConversations(orderId) {
  ensureMessagingCollections();
  return db().conversations
    .filter((c) => c.orderId === orderId)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

function getOrCreateOrderConversation(orderId, { channel = "web", externalThreadId = "", sourceLabel = "" } = {}) {
  ensureMessagingCollections();
  const order = getOpsOrder(orderId);
  if (!order) return null;
  const normalizedChannel = normalizeMessageChannel(channel);
  const externalId = String(externalThreadId || "").trim();
  const existing = db().conversations.find((c) =>
    c.orderId === orderId
    && c.channel === normalizedChannel
    && (externalId ? c.externalThreadId === externalId : !c.externalThreadId)
  );
  if (existing) return existing;
  const createdAt = now();
  const conversation = {
    id: nextSeqId("CONV"),
    orderId,
    channel: normalizedChannel,
    externalThreadId: externalId,
    sourceLabel: String(sourceLabel || "").trim(),
    status: "open",
    createdAt,
    updatedAt: createdAt,
    lastMessageAt: null,
  };
  db().conversations.push(conversation);
  return conversation;
}

export function listOrderMessages(orderId, { channel } = {}) {
  ensureMessagingCollections();
  const normalizedChannel = channel ? normalizeMessageChannel(channel) : null;
  return db().conversationMessages
    .filter((m) => m.orderId === orderId && (!normalizedChannel || m.channel === normalizedChannel))
    .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
}

export function sendOrderMessage(orderId, {
  body = "",
  attachments = [],
  channel = "web",
  actorRole = "customer",
  actorId = "",
  externalThreadId = "",
  sourceLabel = "",
} = {}) {
  const trimmedBody = String(body || "").trim();
  const normalizedAttachments = normalizeOrderMedia(attachments);
  if (!trimmedBody && normalizedAttachments.length === 0) return null;
  const conversation = getOrCreateOrderConversation(orderId, { channel, externalThreadId, sourceLabel });
  if (!conversation) return null;
  const role = normalizeActorRole(actorRole);
  const createdAt = now();
  const message = {
    id: nextSeqId("MSG"),
    orderId,
    conversationId: conversation.id,
    channel: conversation.channel,
    externalThreadId: conversation.externalThreadId || "",
    actorRole: role,
    actorId: String(actorId || role),
    body: trimmedBody,
    attachments: normalizedAttachments,
    sourceLabel: conversation.sourceLabel || "",
    createdAt,
  };
  db().conversationMessages.push(message);
  conversation.status = role === "ops" ? "waitingCustomer" : role === "customer" ? "waitingOps" : "open";
  conversation.lastMessageAt = createdAt;
  conversation.updatedAt = createdAt;
  audit(actorId || role, "conversation", conversation.id, "message", null, role);
  persist();
  return publicConversationMessage(message);
}

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
    ...(m.name ? { name: maskContacts(m.name) } : {}),
    ...(m.size ? { size: m.size } : {}),
    ...(m.originalSize ? { originalSize: m.originalSize } : {}),
    ...(m.width ? { width: m.width } : {}),
    ...(m.height ? { height: m.height } : {}),
    ...(m.optimized ? { optimized: true } : {}),
    ...(m.transient ? { transient: true } : {}),
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
  const dia = getQuoteDiamondCandidate(orderId);
  if (intake.productLine === "solitaire" && !dia) return false; // 고객 선택 이후 재시도
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

const SHIPPING_REQUIRED_FIELDS = ["recipientName", "phone", "addressLine1", "city", "region", "postalCode", "country"];

function normalizeShippingAddress(address = {}) {
  return {
    recipientName: String(address.recipientName || "").trim(),
    phone: String(address.phone || "").trim(),
    addressLine1: String(address.addressLine1 || "").trim(),
    addressLine2: String(address.addressLine2 || "").trim(),
    city: String(address.city || "").trim(),
    region: String(address.region || "").trim(),
    postalCode: String(address.postalCode || "").trim(),
    country: String(address.country || "").trim(),
    notes: String(address.notes || "").trim(),
  };
}

export function isShippingAddressComplete(address) {
  if (!address) return false;
  const normalized = normalizeShippingAddress(address);
  return SHIPPING_REQUIRED_FIELDS.every((field) => normalized[field]);
}

export function updateShippingAddress(orderId, address, actor = "customer") {
  const o = getOpsOrder(orderId);
  if (!o) return null;
  const before = o.shippingAddress ? JSON.stringify(o.shippingAddress) : "";
  const normalized = normalizeShippingAddress(address);
  o.shippingAddress = {
    ...normalized,
    updatedAt: now(),
    confirmedAt: isShippingAddressComplete(normalized) ? now() : "",
  };
  audit(actor, "order", orderId, "shippingAddress", before, JSON.stringify(o.shippingAddress));
  persist();
  return o.shippingAddress;
}

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
export function submitQcForPr(prId, { video, cert, actualWeightG, media }) {
  const pr = getProcurement(prId);
  const finalMedia = normalizeOrderMedia(media?.length ? media : [video && { kind: "video", src: video }].filter(Boolean));
  pr.result = { video: video || finalMedia[0]?.src || "", cert, actualWeightG, media: finalMedia };
  pr.status = "submitted";
  upsertMilestone(pr.orderId, "finalQcVideo", { status: "done", publishToClient: true, link: pr.result.video || "" });
  upsertMilestone(pr.orderId, "igiInscriptionVerified", { status: "inProgress", publishToClient: false });
  // 실중량 증빙 제출 즉시 잔금 자동 정산 (어드민 수동 정산 제거)
  if (actualWeightG && listQuotes(pr.orderId).some((q) => q.status === "accepted")) {
    recordActualWeight(pr.orderId, actualWeightG);
  }
  // 체크포인트 ③: 완성품 영상 → 고객 최종 컨펌 액션 (증거 보존)
  createCustomerAction(pr.orderId, { type: "finalConfirmation", prompt: "finalQc", link: pr.result.video || "", media: finalMedia, note: cert || "" });
  const o = getOpsOrder(pr.orderId);
  if (o.status === "PRODUCTION") updateOpsOrder(o.id, { status: "QC" }, pr.supplierId);
  audit(pr.supplierId, "procurement", prId, "result", null, "qc");
  persist();
  return pr;
}

export function publishFinalMedia(orderId, { media, note, cert, actualWeightG }, actor = "ops") {
  const order = getOpsOrder(orderId);
  if (!order) return null;
  const finalMedia = normalizeOrderMedia(media || []);
  const primary = finalMedia[0]?.src || "";
  listCustomerActions(orderId, true)
    .filter((a) => a.type === "finalConfirmation")
    .forEach((a) => { a.status = "cancelled"; });
  upsertMilestone(orderId, "finalQcVideo", {
    status: "done",
    publishToClient: true,
    link: primary,
    clientUpdate: maskContacts(note || ""),
  });
  if (cert) {
    upsertMilestone(orderId, "igiInscriptionVerified", {
      status: "done",
      publishToClient: true,
      clientUpdate: maskContacts(cert),
    });
  }
  if (actualWeightG && listQuotes(orderId).some((q) => q.status === "accepted")) {
    recordActualWeight(orderId, Number(actualWeightG));
  }
  const action = createCustomerAction(orderId, {
    type: "finalConfirmation",
    prompt: "finalQc",
    link: primary,
    media: finalMedia,
    note: maskContacts(note || ""),
  });
  if (["PRODUCTION", "CAD"].includes(order.status)) updateOpsOrder(orderId, { status: "QC" }, actor);
  audit(actor, "customerAction", action.id, "proxyFinal", null, String(finalMedia.length));
  persist();
  return action;
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
export function getQuoteDiamondCandidate(orderId) {
  const order = getOpsOrder(orderId);
  if (!order) return null;
  if (order.selectedDiamondId) return getCandidate(order.selectedDiamondId);
  return listCandidates({ orderId }).find((c) => c.clientSelection === "selected"
    && c.selectionSubmittedAt
    && c.availability === "available"
    && c.published !== false) || null;
}
export function submitCandidates(prId, candidates) {
  const pr = getProcurement(prId);
  const existing = listCandidates({ orderId: pr.orderId }).length;
  const created = candidates.map((cand, i) => {
    const media = normalizeOrderMedia(cand.media?.length
      ? cand.media
      : [
          cand.image && { kind: "image", src: cand.image },
          cand.video && { kind: "video", src: cand.video },
        ].filter(Boolean));
    return {
      id: `DIA-${pr.orderId}-${String(existing + i + 1).padStart(2, "0")}`,
      orderId: pr.orderId, prId,
      igiNo: cand.igiNo, shape: cand.shape, carat: cand.carat, color: cand.color, clarity: cand.clarity,
      growth: cand.growth, lab: cand.lab, proportions: cand.proportions || {},
      reportUrl: cand.reportUrl || "",
      image: media.find((m) => m.kind === "image")?.src || cand.image || "",
      video: media.find((m) => m.kind === "video")?.src || cand.video || "",
      media,
      clientNote: maskContacts(cand.clientNote || cand.note || ""),
      colorTreatment: cand.colorTreatment || "disclosed", availability: "available",
      procurementCostUsd: cand.procurementCostUsd, supplierId: pr.supplierId,
      internalReview: null, internalNotes: "", published: false, customerPriceUsd: null,
      clientSelection: "none", stockConfirmed: false, locked: false, createdAt: now(),
    };
  });
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
export function createProxyDiamondCandidate(orderId, payload, actor = "ops") {
  const order = getOpsOrder(orderId);
  if (!order) return null;
  const existing = listCandidates({ orderId }).length;
  const media = normalizeOrderMedia(payload.media || []);
  const shape = payload.shape || "round";
  const carat = Number(payload.carat) || 1;
  const candidate = {
    id: `DIA-${orderId}-${String(existing + 1).padStart(2, "0")}`,
    orderId, prId: null, poolDiamondId: null,
    igiNo: payload.igiNo || `OPS-${String(existing + 1).padStart(2, "0")}`,
    shape, carat, color: payload.color || "E", clarity: payload.clarity || "VS1",
    growth: payload.growth || "CVD", lab: payload.lab || "IGI",
    proportions: payload.proportions || {}, reportUrl: payload.reportUrl || "",
    image: media.find((m) => m.kind === "image")?.src || "",
    video: media.find((m) => m.kind === "video")?.src || "",
    media,
    clientNote: maskContacts(payload.clientNote || ""),
    colorTreatment: payload.colorTreatment || "disclosed",
    availability: "available",
    procurementCostUsd: Number(payload.procurementCostUsd) || 0,
    supplierId: payload.supplierId || "ops-proxy",
    internalReview: "recommended",
    internalNotes: maskContacts(payload.internalNotes || "operator proxy upload"),
    published: true,
    customerPriceUsd: Number(payload.customerPriceUsd) || candidateAutoPrice(benchmarkFor(shape, carat)?.unitUsdPerCt || 320, carat, db().settings.opsMultiplier),
    clientSelection: "none",
    stockConfirmed: false,
    locked: false,
    createdAt: now(),
  };
  db().diamondCands.push(candidate);
  if (!order.selectedDiamondId && order.status === "STYLE_SELECTION") {
    updateOpsOrder(order.id, { status: "STONE_SELECTION" }, actor);
  }
  if (!order.selectedDiamondId && !listCustomerActions(orderId, true).some((a) => a.type === "diamondSelection")) {
    createCustomerAction(orderId, {
      type: "diamondSelection",
      prompt: "Select a diamond from operator-posted candidates",
      link: candidate.image || candidate.video || "",
      media,
      note: candidate.clientNote,
    });
  }
  audit(actor, "diamond", candidate.id, "proxyPublished", null, "true");
  persist();
  return candidate;
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
// ④ 고객 후보 선택. 최종 락 전까지는 고객 선택 상태만 저장한다.
export function toggleShortlist(diaId, actor) {
  const c = getCandidate(diaId);
  const order = getOpsOrder(c.orderId);
  if (order.selectedDiamondId) return c; // 이미 락된 주문
  if (c.clientSelection === "selected") {
    c.clientSelection = "none";
    c.selectionSubmittedAt = "";
    audit(actor, "diamond", diaId, "clientSelection", "selected", "none");
  } else {
    // 매뉴얼 §13: 무효 후보(비공개·품절·배치 만료)는 선택 차단
    const pr = c.prId ? getProcurement(c.prId) : null;
    const expired = pr?.batchValidUntil && pr.batchValidUntil < today();
    if (!c.published || c.availability !== "available" || expired) throw new Error("notSelectable");
    c.clientSelection = "selected";
    c.selectionSubmittedAt = "";
    audit(actor, "diamond", diaId, "clientSelection", "none", "selected");
  }
  persist();
  return c;
}

// 고객이 고른 후보를 견적 기준으로 제출한다. 최종 다이아 락은 디파짓 입금 확인 후 진행한다.
export function submitDiamondSelection(orderId, actor) {
  const order = getOpsOrder(orderId);
  if (!order || order.selectedDiamondId) return null;
  const selected = listCandidates({ orderId })
    .filter((c) => c.clientSelection === "selected" && c.availability === "available" && c.published !== false);
  const candidate = selected[0] || null;
  if (!candidate) return null;

  selected.slice(1).forEach((other) => {
    other.clientSelection = "none";
    other.selectionSubmittedAt = "";
  });
  candidate.selectionSubmittedAt = candidate.selectionSubmittedAt || now();

  listProcurements({ orderId })
    .filter((pr) => pr.type === "stockConfirm" && pr.status === "open")
    .forEach((pr) => {
      pr.status = "closed";
      pr.result = { skipped: "depositBeforeDiamondLock" };
    });

  listCustomerActions(orderId, true)
    .filter((action) => action.type === "diamondSelection")
    .forEach((action) => respondCustomerAction(action.id, { decision: "submitted" }, actor || "customer"));

  if (order.status === "STONE_SELECTION") updateOpsOrder(order.id, { status: "QUOTATION" }, actor || "customer");
  upsertMilestone(orderId, "diamondLocked", {
    status: "waitingClient",
    publishToClient: false,
    clientUpdate: "Diamond selected; deposit required to lock it.",
  });

  if (!tryAutoQuote(orderId)) {
    const intake = getIntake(order.intakeId);
    autoIssuePr(orderId, "weightLabor", {
      brief: intake ? autoBrief(intake) : "",
      metal: intake?.metal || null,
      measurements: Object.entries(intake?.conditional || {}).map(([k, v]) => `${k}: ${v}`).join(", ") || null,
    });
  }
  persist();
  return candidate;
}

export function requestStockConfirm(orderId, actor) {
  return submitDiamondSelection(orderId, actor);
}

// 확인된 고객 선택 후보 중 하나를 최종 락 (→ QUOTATION). 디파짓은 운영자 수동 확인.
export function lockSelectedCandidate(diaId, actor) {
  const c = getCandidate(diaId);
  if (!(c.clientSelection === "selected" && c.stockConfirmed && c.availability === "available")) throw new Error("notLockable");
  audit(actor, "diamond", diaId, "lock", null, "selected");
  lockCandidate(diaId);
  // 같은 주문의 다른 선택 후보 초기화
  listCandidates({ orderId: c.orderId }).forEach((o) => {
    if (o.id !== diaId && o.clientSelection === "selected") o.clientSelection = "none";
  });
  listCustomerActions(c.orderId, true)
    .filter((action) => action.type === "diamondSelection")
    .forEach((action) => respondCustomerAction(action.id, { decision: "approved", value: diaId }, actor || "customer"));
  persist();
  return c;
}

// 벤더 재고 확인 응답: 있음 → stockConfirmed(락은 고객이 최종 선택 시), 품절 → sold·비공개·선택 해제
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
    c.stockConfirmed = true;
    if (c.clientSelection === "selected" && !getOpsOrder(c.orderId)?.selectedDiamondId) {
      c.selectionSubmittedAt = c.selectionSubmittedAt || now();
      submitDiamondSelection(c.orderId, pr.supplierId);
    }
  } else {
    setCandidateAvailability(c.id, "sold"); // §13: 즉시 비공개 포함
    c.clientSelection = "none";
    c.stockConfirmed = false;
    audit(pr.supplierId, "diamond", c.id, "clientSelection", "selected", "none");
    if (listCandidates({ orderId: c.orderId, publishedOnly: true }).length > 0
      && !listCustomerActions(c.orderId, true).some((a) => a.type === "diamondSelection")) {
      createCustomerAction(c.orderId, {
        type: "diamondSelection",
        prompt: "Selected diamond is no longer available. Please choose another candidate.",
      });
    }
  }
  persist();
  return pr;
}
export function lockCandidate(diaId, actor = "auto") {
  const c = getCandidate(diaId);
  if (c.availability !== "available") return null;
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
  listCandidates({ orderId: c.orderId }).forEach((other) => {
    if (other.id !== diaId && other.clientSelection === "selected") {
      other.clientSelection = "none";
      other.selectionSubmittedAt = "";
    }
  });
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
  updateOpsOrder(order.id, { selectedDiamondId: diaId, status: "QUOTATION" }, actor);
  upsertMilestone(order.id, "diamondLocked", { status: "done", publishToClient: true, clientUpdate: c.id });
  tryAutoQuote(order.id); // 스펙이 준비돼 있으면 어드민 없이 견적 즉시 발송
  return c;
}

// ---------- styles & specs ----------
const MAX_STYLE_MEDIA = 5;
function normalizeOpsStyleMedia(style) {
  if (!Array.isArray(style.media)) return style;
  const media = style.media.slice(0, MAX_STYLE_MEDIA);
  return {
    ...style,
    media,
    coverImage: style.coverImage || media[0]?.src || "",
    mediaComplete: style.mediaComplete ?? media.length > 0,
  };
}

function nextStyleId(prefix, list) {
  const usedIds = new Set(list.map((style) => style.id));
  const matcher = new RegExp(`^${prefix}-(\\d+)$`);
  const maxExisting = list.reduce((max, style) => {
    const match = matcher.exec(style.id || "");
    return match ? Math.max(max, Number(match[1]) || 0) : max;
  }, 0);
  let index = maxExisting + 1;
  let id = `${prefix}-${String(index).padStart(3, "0")}`;
  while (usedIds.has(id) || REMOVED_DUPLICATE_SEED_STYLE_IDS.has(id)) {
    index += 1;
    id = `${prefix}-${String(index).padStart(3, "0")}`;
  }
  return id;
}

export function listOpsStyles({ publishedOnly = false } = {}) {
  return db().opsStyles.filter((st) => !publishedOnly || (st.published && st.availableForSale));
}
export function getOpsStyle(id) { return db().opsStyles.find((st) => st.id === id) || null; }
export function saveOpsStyle(style) {
  const normalized = normalizeOpsStyleMedia(style);
  const list = db().opsStyles;
  const i = list.findIndex((st) => st.id === normalized.id);
  if (i >= 0) {
    list[i] = { ...list[i], ...normalized };
    persist();
    return list[i];
  }
  const created = (() => {
    const prefix = { ring: "RING", necklace: "NECK", earrings: "EARR", bangle: "BRAC" }[normalized.category] || "STYL";
    return { published: false, availableForSale: false, mediaComplete: false, ...normalized, id: nextStyleId(prefix, list) };
  })();
  list.push(created);
  persist();
  return created;
}
export function deleteOpsStyle(id) {
  const list = db().opsStyles;
  const i = list.findIndex((st) => st.id === id);
  if (i >= 0) {
    list.splice(i, 1);
    db().styleSpecs = db().styleSpecs.filter((sp) => sp.styleId !== id);
    persist();
  }
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
export function deleteStyleSpec(id) {
  db().styleSpecs = db().styleSpecs.filter((sp) => sp.id !== id);
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
  const dia = getQuoteDiamondCandidate(orderId);
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
    // 확정 제안 필드 — 고객에게는 미디어·스펙·총액만 보인다 (breakdown 미노출)
    proposalMedia: [], stoneSpec: null, substitutionNote: "", depositReportedAt: null,
  };
  db().quotes.push(quote);
  audit("ops", "quote", quote.id, "create", null, "draft");
  persist();
  return quote;
}
// 어드민 제안 컴포저: 고객에게 보여줄 미디어·스톤 스펙·대체 안내문
export function updateQuoteProposal(quoteId, { proposalMedia, stoneSpec, substitutionNote }) {
  const q = db().quotes.find((x) => x.id === quoteId);
  if (!q) return null;
  if (proposalMedia !== undefined) q.proposalMedia = normalizeOrderMedia(proposalMedia).slice(0, 5);
  if (stoneSpec !== undefined) q.stoneSpec = stoneSpec;
  if (substitutionNote !== undefined) q.substitutionNote = substitutionNote;
  persist();
  return q;
}
export function sendQuote(quoteId) {
  const q = db().quotes.find((x) => x.id === quoteId);
  q.status = "sent";
  // 스펙/미디어가 비어 있으면 확정 후보에서 자동 채움 — 자동 견적 경로도 제안 카드가 완성된다
  const dia = getQuoteDiamondCandidate(q.orderId);
  if (dia) {
    if (!q.stoneSpec) {
      q.stoneSpec = {
        shape: dia.shape, carat: dia.carat, color: dia.color, clarity: dia.clarity,
        growth: dia.growth, lab: dia.lab, igiNo: dia.igiNo,
      };
    }
    if (!q.proposalMedia?.length && dia.media?.length) {
      q.proposalMedia = normalizeOrderMedia(dia.media).slice(0, 5);
    }
  }
  createCustomerAction(q.orderId, { type: "quoteAcceptance", prompt: q.id, link: "" });
  persist();
  return q;
}
// 고객 셀프 리포트: "디파짓 보냈어요" → 어드민 입금 확인 대기
export function reportDepositSent(quoteId, actor = "customer") {
  const q = db().quotes.find((x) => x.id === quoteId);
  if (!q || q.status !== "accepted" || q.depositReportedAt) return q;
  q.depositReportedAt = now();
  upsertMilestone(q.orderId, "depositReceived", { status: "waitingClient", publishToClient: true });
  audit(actor, "quote", quoteId, "depositReported", null, q.depositReportedAt);
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
  const order = getOpsOrder(orderId);
  const intake = order ? getIntake(order.intakeId) : null;
  if (intake?.productLine === "solitaire" && !order?.selectedDiamondId) {
    const candidate = getQuoteDiamondCandidate(orderId);
    if (candidate) lockCandidate(candidate.id, "ops");
  }
  updateOpsOrder(orderId, { status: "CAD" });
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
export function addCadVersion(orderId, { fileUrl, media, supplierId, note }) {
  const order = getOpsOrder(orderId);
  const version = listCadReviews(orderId).length + 1;
  const reviewMedia = normalizeOrderMedia(media?.length ? media : [fileUrl && { kind: mediaKindFromSrc(fileUrl), src: fileUrl }].filter(Boolean));
  const review = {
    id: nextSeqId("CADR"), orderId, version,
    fileUrl: fileUrl || reviewMedia[0]?.src || "",
    media: reviewMedia,
    clientNote: maskContacts(note || ""),
    supplierUploadedAt: now(), internalReview: "", sentAt: null,
    decision: null, feedback: [], annotations: [], confirmedMeasurements: "", evidence: "", decidedAt: null,
  };
  db().cadReviews.push(review);
  upsertMilestone(orderId, "cadIssued", { status: "waitingClient", publishToClient: true, clientUpdate: `CAD V${version} ready for review`, link: review.fileUrl });
  listCustomerActions(orderId, true)
    .filter((a) => a.type === "cadReview")
    .forEach((a) => { a.status = "cancelled"; });
  createCustomerAction(orderId, { type: "cadReview", prompt: `CAD V${version}`, link: review.fileUrl, media: reviewMedia, note: review.clientNote });
  if (order && ["STYLE_SELECTION", "STONE_SELECTION", "QUOTATION"].includes(order.status)) {
    updateOpsOrder(orderId, { status: "CAD" }, supplierId || "supplier");
  }
  audit(supplierId || "supplier", "cad", review.id, "create", null, `V${version}`);
  persist();
  return review;
}
export function decideCad(reviewId, { decision, feedback, annotations, annotatedSrc, confirmedMeasurements, attachments }, actor) {
  const r = db().cadReviews.find((x) => x.id === reviewId);
  r.decision = decision;
  r.feedback = (feedback || []).map((f) => maskContacts(f)).filter(Boolean);
  r.annotations = (annotations || []).filter((a) => validateAnnotation(a, db().chipCatalog));
  r.annotatedSrc = annotatedSrc || ""; // 핀이 찍힌 정지 이미지 — 벤더에게 같은 캔버스로 전달
  r.confirmedMeasurements = confirmedMeasurements || "";
  r.responseAttachments = normalizeOrderMedia(attachments || []);
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
export function createCustomerAction(orderId, { type, prompt, link, dueDate, media, note }) {
  const action = {
    id: nextSeqId("CA"), orderId, type, prompt: prompt || "", link: link || "",
    media: normalizeOrderMedia(media || []), note: maskContacts(note || ""),
    dueDate: dueDate || null, status: "open", response: null, decision: null,
    rejectionReason: "", responseAttachments: [], respondedAt: null, createdAt: now(),
  };
  db().customerActions.push(action);
  persist();
  return action;
}
export function respondCustomerAction(actionId, response, actor) {
  const a = db().customerActions.find((x) => x.id === actionId);
  const oldStatus = a.status;
  const normalized = normalizeActionResponse(response);
  a.status = normalized.status;
  a.response = normalized.value;
  a.decision = normalized.decision;
  a.rejectionReason = normalized.reason;
  a.responseAttachments = normalized.attachments;
  a.respondedAt = now();
  audit(actor, "customerAction", actionId, "status", oldStatus, a.status);
  persist();
  return a;
}

export function rejectDiamondCandidates(orderId, { reason, attachments } = {}, actor = "customer") {
  const a = db().customerActions.find((x) => x.orderId === orderId && x.type === "diamondSelection" && x.status === "open");
  if (!a) return null;
  listCandidates({ orderId }).forEach((c) => {
    c.clientSelection = "none";
    c.selectionSubmittedAt = "";
  });
  const action = respondCustomerAction(a.id, { decision: "rejected", reason, attachments }, actor);
  upsertMilestone(orderId, "diamondLocked", {
    status: "blocked",
    publishToClient: true,
    clientUpdate: action.rejectionReason,
  });
  updateOpsOrder(orderId, { status: "STONE_SELECTION" }, actor);
  return action;
}

// 최종 실물 컨펌 — "이 영상의 실물이 배송됩니다"에 대한 고객 동의. 분쟁 방어 증거.
export function confirmFinal(orderId, actor) {
  const a = db().customerActions.find((x) => x.orderId === orderId && x.type === "finalConfirmation" && x.status === "open");
  if (!a) return null;
  respondCustomerAction(a.id, { decision: "approved", value: "confirmed" }, actor);
  updateOpsOrder(orderId, { status: "BALANCE" }, actor);
  return a;
}

export function rejectFinalConfirmation(orderId, { reason, attachments } = {}, actor = "customer") {
  const a = db().customerActions.find((x) => x.orderId === orderId && x.type === "finalConfirmation" && x.status === "open");
  if (!a) return null;
  const action = respondCustomerAction(a.id, { decision: "rejected", reason, attachments }, actor);
  upsertMilestone(orderId, "finalQcVideo", {
    status: "blocked",
    publishToClient: true,
    clientUpdate: action.rejectionReason,
  });
  updateOpsOrder(orderId, { status: "QC" }, actor);
  return action;
}

// ---------- client portal (보안 프로젝션 적용) ----------
function normalizePortalCode(code) {
  return String(code || "").trim().toUpperCase();
}

export function portalView(orderId, { customerId, queryCode, userRole } = {}) {
  sweepExpiredBatches();
  const order = getOpsOrder(orderId);
  if (!order) return null;

  const hasCustomerSession = Boolean(customerId);
  const sessionUser = hasCustomerSession ? getUser(customerId) : null;
  const ownsOrder = hasCustomerSession && order.customerId === customerId;
  const codeMatches = Boolean(normalizePortalCode(queryCode))
    && normalizePortalCode(order.queryCode) === normalizePortalCode(queryCode);
  const guestCodeMatches = !hasCustomerSession && codeMatches;
  const adminPreviewMatches = (sessionUser?.role === "admin" || userRole === "admin") && codeMatches;
  const authorized = ownsOrder || guestCodeMatches || adminPreviewMatches;
  if (!authorized) return null;
  const quote = listQuotes(orderId).find((q) => q.status === "sent" || q.status === "accepted") || null;
  // 확정 제안 flow: 고객은 후보 비교 없이 제안 1장만 본다 — diamondSelection 액션도 미노출
  const visibleActions = listCustomerActions(orderId, true)
    .filter((action) => action.type !== "diamondSelection");
  return {
    order: customerOrderView(order),
    intake: getIntake(order.intakeId),
    style: order.styleId ? getOpsStyle(order.styleId) : null,
    selected: order.selectedDiamondId ? publicDiamondView(getCandidate(order.selectedDiamondId)) : null,
    // 보안 프로젝션: 총액·디파짓·잔금만 — breakdown(다이아/메탈/패키지/중량)은 어드민 전용
    quote: quote && {
      id: quote.id, status: quote.status,
      totalUsd: quote.totalUsd, depositUsd: quote.depositUsd, balanceUsd: quote.balanceUsd,
      validUntil: quote.validUntil, leadDays: quote.leadDays,
      proposalMedia: quote.proposalMedia || [], stoneSpec: quote.stoneSpec || null,
      substitutionNote: quote.substitutionNote || "", depositReportedAt: quote.depositReportedAt || null,
    },
    milestones: listMilestones(orderId).filter((m) => m.publishToClient),
    cad: listCadReviews(orderId).find((c) => !c.hidden) || null, // 모니터링 숨김 버전 제외

    freeRevisionsLeft: freeRevisionsLeft(orderId),
    designChangeFeeUsd: db().settings.designChangeFeeUsd,
    finalAction: visibleActions.find((a) => a.type === "finalConfirmation") || null,
    actions: visibleActions,
    messages: listOrderMessages(orderId).map(publicConversationMessage),
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
// ---------- 고객 리뷰 (인증샷 미디어 퍼스트 · 어드민 검수 후 게시) ----------
export function listReviews(filter = {}) {
  let rows = [...(db().reviews || [])];
  if (filter.orderId) rows = rows.filter((r) => r.orderId === filter.orderId);
  if (filter.publishedOnly) rows = rows.filter((r) => r.status === "published");
  return rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}
// 배송 완료된 주문만, 주문당 1건 — 주문번호가 곧 인증(Verified)
export function submitReview(orderId, { rating, quote, body, media, name, location }, actor = "customer") {
  const order = getOpsOrder(orderId);
  if (!order || !["DELIVERED", "ARCHIVED"].includes(order.status)) throw new Error("reviewNotAllowed");
  const existing = listReviews({ orderId }).find((r) => r.status !== "hidden");
  if (existing) return existing;
  const review = {
    id: nextSeqId("REV"), orderId,
    name: (name || order.customerName || "Client").trim(),
    location: (location || "").trim(),
    rating: Math.min(5, Math.max(1, Number(rating) || 5)),
    quote: maskContacts((quote || "").trim()),
    body: maskContacts((body || "").trim()),
    media: normalizeOrderMedia(media || []).slice(0, 5),
    status: "pending", createdAt: now(),
  };
  db().reviews.push(review);
  audit(actor, "review", review.id, "create", null, "pending");
  persist();
  return review;
}
export function setReviewStatus(reviewId, status, actor = "ops") {
  const review = db().reviews.find((r) => r.id === reviewId);
  if (!review) return null;
  audit(actor, "review", reviewId, "status", review.status, status);
  review.status = status;
  persist();
  return review;
}

export function getSettings() { return db().settings; }
export function updateSettings(patch) { Object.assign(db().settings, patch); persist(); }
