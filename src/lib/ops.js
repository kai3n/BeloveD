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
export const CHAIN_STYLE_OPTIONS = ["cable", "box", "wheat", "rope", "singapore", "figaro", "rolo", "paperclip"];
export const CLASP_OPTIONS = ["lobster", "springRing", "boxSafety", "hiddenSafety", "toggle", "adjustableSlider"];
export const EARRING_PAIRING_OPTIONS = ["matchedPush", "matchedScrew", "matchedSecureLock", "matchedLever", "clipOnPair", "singleLeftRight"];
export const BRACELET_WRIST_OPTIONS = ["5.5in", "6in", "6.5in", "7in", "7.5in", "8in", "8.5in"];
export const PRODUCT_LINES = ["solitaire", "multi"];
export const OPS_CATEGORIES = ["ring", "necklace", "earrings", "bangle"];
export const PR_TYPES = ["diamondCandidates", "weightLabor", "stockConfirm", "cad", "qc", "ship"];
// 슬롯 구조가 "어떤 각도를 찍어야 하는지"를 언어 설명 없이 강제한다
export const CAD_SLOTS = ["render360", "side", "wear"];
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
  "customerPriceUsd", "clientSelection", "stockConfirmed", "published",
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

// 재고 확인 태스크용 다이아 안전 필드 — 고객가·원가·내부검수 제외.
// 내부 id(DIA-{OrderID}-NN)는 주문번호가 박혀 있으므로 IGI 번호로만 식별시킨다.
const SUPPLIER_DIAMOND_FIELDS = ["igiNo", "shape", "carat", "color", "clarity", "growth", "lab", "image", "video"];
export function supplierDiamondView(cand) {
  if (!cand) return null;
  const out = {};
  for (const f of SUPPLIER_DIAMOND_FIELDS) {
    if (cand[f] !== undefined) out[f] = cand[f];
  }
  return out;
}

// 벤더에게 보여줄 익명 "작업 묶음" 코드 — Order ID를 노출하지 않으면서 같은 주문의 작업을 묶는다.
// 결정적 해시라 같은 주문이면 항상 같은 코드, 주문번호는 역산 불가.
export function jobCode(orderId) {
  if (!orderId) return "";
  let h = 2166136261;
  for (let i = 0; i < orderId.length; i++) { h ^= orderId.charCodeAt(i); h = Math.imul(h, 16777619); }
  return "JOB-" + (h >>> 0).toString(36).toUpperCase().slice(-4);
}

// 서플라이어 태스크 뷰: 고객 신원·판매가·Order ID 제외 (PR ID로만 식별)
// visualBrief: 검수 승인 레퍼런스 + 직전 리비전 핀만 — pending/rejected 절대 미포함
export function supplierTaskView(pr, order, style, intake = null, revisionReview = null, diamond = null) {
  return {
    id: pr.id,
    jobCode: jobCode(pr.orderId), // 같은 주문 작업을 묶는 익명 코드 (Order ID는 미노출)
    type: pr.type,
    diamond: supplierDiamondView(diamond),
    dueDate: pr.dueDate,
    batchValidUntil: pr.batchValidUntil ?? null,
    brief: pr.brief,
    status: pr.status,
    requiredDate: order?.requiredDate ?? null,
    styleRef: style?.id ?? null,
    styleEstWeightG: style?.estWeightG ?? null,
    // 요구사항 종합 카드용 안전 필드 (제품 사양만 — 고객 신원·가격 절대 미포함)
    category: intake?.category ?? null,
    productLine: intake?.productLine ?? null,
    conditional: intake?.conditional ?? null,
    stonePrefs: intake?.stonePrefs ?? null,
    multiSpec: intake?.multiSpec ?? null,
    styleCover: style?.coverImage ?? null,
    styleName: style?.name ?? null,
    metal: pr.metal ?? intake?.metal ?? null,
    measurements: pr.measurements ?? null,
    references: (intake?.referenceMedia || [])
      .filter((m) => m.status === "approved")
      .map(({ id, kind, src, annotations }) => ({ id, kind, src, annotations })),
    revision: revisionReview
      ? {
        version: revisionReview.version,
        // 핀이 찍힌 이미지를 우선 — 대표 파일이 영상일 때 핀 좌표가 어긋나지 않도록
        fileUrl: revisionReview.annotatedSrc || revisionReview.fileUrl,
        annotations: revisionReview.annotations || [],
      }
      : null,
  };
}

// ---------- 어드민 최소 개입 자동화 ----------
// 인테이크 → 벤더 브리프 자동 생성. 고객 신원은 절대 포함하지 않는다.
export function autoBrief(intake) {
  if (intake.productLine === "solitaire" && intake.stonePrefs) {
    const s = intake.stonePrefs;
    return [
      s.carat && `${s.carat}ct ${s.shape}`, s.color && `${s.color}/${s.clarity}`, s.growth, s.lab,
      s.colorTreatment === "disclosed" ? "post-growth treatment OK" : s.colorTreatment,
      s.fluorescence && s.fluorescence !== "none" && `fluor ${s.fluorescence}`,
      s.lwRatio && `L/W ${s.lwRatio}`,
    ].filter(Boolean).join(" · ");
  }
  if (intake.multiSpec) {
    const m = intake.multiSpec;
    return [m.meleeSpec && `melee: ${m.meleeSpec}`, m.overallDims, m.arrangement, m.standard].filter(Boolean).join(" · ");
  }
  return "see style reference";
}

// 벤치마크 자동가: $/ct × 캐럿 × 멀티플라이어 — 벤더 원가와 무관하게 일관된 소비자가
export function candidateAutoPrice(unitUsdPerCt, carat, multiplier) {
  return Math.round(unitUsdPerCt * carat * multiplier);
}

// 자동 공개 최소 요건 — 미달 후보는 보류되어 어드민 체크리스트에 표시된다
export function isCandidateComplete(c) {
  return Boolean(c.igiNo && Number(c.carat) > 0 && c.image);
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

// ---------- 벤더 다이아 풀 매칭 (순수) ----------
// 등급 순서: 인덱스가 작을수록 고등급. "등급 이상" = 스톤 인덱스 ≤ 요청 인덱스.
export const COLOR_ORDER = ["D", "E", "F", "G", "H", "I", "J", "K"];
export const CLARITY_ORDER = ["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2"];

function gradeAtLeast(order, stoneGrade, prefGrade) {
  const pi = order.indexOf(prefGrade);
  if (pi < 0) return true; // 요청 등급이 목록에 없으면 해당 축 무시(관대)
  const si = order.indexOf(stoneGrade);
  return si >= 0 && si <= pi;
}

// 풀 스톤이 고객 선호(prefs)에 매칭되는지. opts: { caratUnder, caratOver }
export function poolStoneMatches(stone, prefs, opts) {
  if (!stone || !prefs) return false;
  if (stone.shape !== prefs.shape) return false;
  const carat = Number(stone.carat), want = Number(prefs.carat);
  if (!(carat >= want - opts.caratUnder && carat <= want + opts.caratOver)) return false;
  if (!gradeAtLeast(COLOR_ORDER, stone.color, prefs.color)) return false;
  if (!gradeAtLeast(CLARITY_ORDER, stone.clarity, prefs.clarity)) return false;
  if (prefs.growth && stone.growth !== prefs.growth) return false;
  return true;
}
