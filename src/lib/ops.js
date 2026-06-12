// Diamond Operations Manual 순수 로직 — 주문 상태/마일스톤/견적 공식/보안 프로젝션

export const ORDER_STATUSES = [
  "STYLE_SELECTION", "STONE_SELECTION", "QUOTATION", "CAD", "PRODUCTION",
  "QC", "BALANCE", "SHIPPING", "DELIVERED", "ARCHIVED", "PAUSED", "CANCELLED",
];

// 13개 마일스톤 — 고정 순서 (매뉴얼 §9)
export const MILESTONE_STAGES = [
  "depositReceived", "diamondLocked", "cadIssued", "cadApproved", "productionStarted",
  "settingPolishing", "finalQcVideo", "igiInscriptionVerified", "actualMetalReconciled",
  "balanceReceived", "sentDomesticWarehouse", "oceanShipment", "deliveredArchived",
];

export const MILESTONE_STATUSES = ["pending", "inProgress", "waitingClient", "blocked", "done"];

export const OPS_METALS = ["14ky", "18ky", "14kr", "18kr", "18kw", "pt"];
export const CHAIN_LENGTHS = ["16in", "18in", "20in"]; // 단일 선택 — 자유 입력 금지
export const PRODUCT_LINES = ["solitaire", "multi"];
export const OPS_CATEGORIES = ["ring", "necklace", "earrings", "bangle"];
export const PR_TYPES = ["diamondCandidates", "weightLabor", "cad", "qc"];
export const DEFECT_REVIEWS = ["recommended", "alternate", "excluded"];

// 벤치마크 매트릭스: 9 쉐입 × 7 캐럿 티어 (기본 가정: CVD·post-growth color treatment·IGI India·D-F·VVS-VS)
export const BENCHMARK_SHAPES = ["round", "oval", "princess", "emerald", "pear", "marquise", "cushion", "radiant", "asscher"];
export const CARAT_TIERS = [
  { key: "0.50-0.69", min: 0.5, max: 0.6999 },
  { key: "0.70-0.99", min: 0.7, max: 0.9999 },
  { key: "1.00-1.49", min: 1.0, max: 1.4999 },
  { key: "1.50-1.99", min: 1.5, max: 1.9999 },
  { key: "2.00-2.49", min: 2.0, max: 2.4999 },
  { key: "2.50-2.99", min: 2.5, max: 2.9999 },
  { key: "3.00+", min: 3.0, max: Infinity },
];

export function tierForCarat(carat) {
  return (CARAT_TIERS.find((t) => carat >= t.min && carat <= t.max) || CARAT_TIERS[6]).key;
}

// 견적 공식 (매뉴얼 §7.2) — 고객에게는 metal/nonMetal/total/deposit/balance만 노출
export function quoteCompute({ carat, benchmarkUsdPerCt, multiplier, estWeightG, metalRefUsdPerG, lossRatePct, nonMetalUsd, depositRate }) {
  const diamondAmountUsd = Math.round(benchmarkUsdPerCt * carat * multiplier);
  const metalAmountUsd = Math.round(estWeightG * metalRefUsdPerG * (1 + lossRatePct / 100));
  const totalUsd = diamondAmountUsd + metalAmountUsd + Math.round(nonMetalUsd);
  const depositUsd = Math.round(totalUsd * depositRate);
  return { diamondAmountUsd, metalAmountUsd, totalUsd, depositUsd, balanceUsd: totalUsd - depositUsd };
}

// 실중량 정산: (실중량 − 견적중량) × 기준가 × (1+로스) 를 잔금에 가감
export function reconcileDelta(estWeightG, actualWeightG, metalRefUsdPerG, lossRatePct) {
  return Math.round((actualWeightG - estWeightG) * metalRefUsdPerG * (1 + lossRatePct / 100));
}

// ---------- 보안 프로젝션 (매뉴얼 §2 — 절대 규칙) ----------
// 고객 공개 다이아: 허용 필드만 (supplier/원가/내부검수/내부노트 절대 제외)
const DIAMOND_PUBLIC_FIELDS = [
  "id", "orderId", "igiNo", "shape", "carat", "color", "clarity", "growth", "lab",
  "proportions", "reportUrl", "image", "video", "colorTreatment", "availability",
  "customerPriceUsd", "clientSelection", "published",
];
export function publicDiamondView(cand) {
  const out = {};
  for (const f of DIAMOND_PUBLIC_FIELDS) {
    if (cand[f] !== undefined) out[f] = cand[f];
  }
  return out;
}

// 고객 주문 뷰: 내부 노트·오너·쿼리코드 제외
export function customerOrderView(order) {
  const { internalNotes, owner, queryCode, ...safe } = order;
  return safe;
}

// 서플라이어 태스크 뷰: 고객 신원·판매가·Order ID 제외 (PR ID로만 식별)
export function supplierTaskView(pr, order, style) {
  return {
    id: pr.id,
    type: pr.type,
    dueDate: pr.dueDate,
    batchValidUntil: pr.batchValidUntil ?? null,
    brief: pr.brief,
    status: pr.status,
    requiredDate: order?.requiredDate ?? null,
    styleRef: style?.id ?? null,
    styleEstWeightG: style?.estWeightG ?? null,
    metal: pr.metal ?? null,
    measurements: pr.measurements ?? null,
  };
}

// 주문별 조회 코드 — 전화번호/생일 등 추측 가능 값 금지
export function randomQueryCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${pick(4)}-${pick(4)}`;
}

// 기본 벤치마크 시드 (USD/ct) — 운영자가 매트릭스에서 갱신
export function defaultBenchmark() {
  const base = { round: 320, oval: 300, princess: 280, emerald: 300, pear: 295, marquise: 290, cushion: 285, radiant: 295, asscher: 290 };
  const tierMult = { "0.50-0.69": 0.55, "0.70-0.99": 0.7, "1.00-1.49": 1.0, "1.50-1.99": 1.3, "2.00-2.49": 1.6, "2.50-2.99": 1.85, "3.00+": 2.2 };
  const rows = [];
  for (const shape of BENCHMARK_SHAPES) {
    for (const tier of CARAT_TIERS) {
      rows.push({ shape, tier: tier.key, unitUsdPerCt: Math.round(base[shape] * tierMult[tier.key]), quoteDate: "2026-06-01" });
    }
  }
  return rows;
}
