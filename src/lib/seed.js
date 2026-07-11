import { defaultBenchmark } from "./ops.js";
import { defaultChipCatalog } from "./chips.js";
import { BASE_COUPONS } from "./coupons.js";
import { styleSeedData } from "./styleSeedData.js";

// 스타일별 제품 라인 — solitaire = 고객이 센터스톤(셰입·캐럿)을 고른다 / multi = 완성형 디자인(스톤 스텝 없음).
// 이름 키워드 추론(halo→multi 오분류로 헤일로 약혼반지의 다이아 스텝이 사라지는 버그)의 명시적 교정.
// styleSeedData.js는 CSV 생성물이라 여기서 병합한다. 어드민이 만든 새 스타일은 Style Library에서 지정.
const STYLE_PRODUCT_LINE = {
  "RING-001": "solitaire", "RING-002": "solitaire", "RING-003": "solitaire", "RING-004": "solitaire",
  "RING-005": "solitaire", "RING-006": "solitaire", "RING-007": "solitaire", "RING-009": "solitaire",
  "BAND-001": "multi", "BAND-005": "multi", "BAND-006": "multi",
  "EARR-001": "multi", "EARR-002": "multi", "EARR-003": "multi", "EARR-004": "multi", "EARR-005": "multi", "EARR-006": "multi",
  "BRAC-001": "multi", "BRAC-002": "multi", "BRAC-003": "multi",
  "NECK-001": "solitaire", "NECK-002": "solitaire", "NECK-003": "multi", "NECK-004": "multi", "NECK-005": "multi",
  "NECK-006": "multi", "NECK-007": "multi", "NECK-008": "multi", "NECK-009": "multi", "NECK-010": "multi",
};

const TWEEZERS = "/assets/lab-diamond-tweezers.webp";
const NOIR_VIDEO = "/assets/diamond-noir-white.mp4";

// 샘플 사진: jewelry-lineup.png에서 제품별로 잘라낸 단독 이미지 (잘림 없음)
const lineup = (name) => ({ kind: "image", src: `/assets/lineup-${name}.png` });

// shape/metal/배송단계는 키로 저장하고 언어별 라벨은 translations.js에서 매핑한다.
export function seed() {
  // 데모 날짜는 현재 기준 상대값 — 고정 날짜가 지나 배치가 만료되며 후보가 unpublish되는 것 방지
  const daysFromNow = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  return {
    counter: 1100,
    users: [
      { id: "u-admin", email: "admin@demo.com", role: "admin", name: "Operations" },
      { id: "u-supplier1", email: "supplier@demo.com", role: "supplier", name: "SUPPLIER-CN-01", active: true, accessCode: "DEMO-A001" },
      { id: "u-supplier2", email: "supplier2@demo.com", role: "supplier", name: "SUPPLIER-CN-02", active: true, accessCode: "DEMO-A002" },
      { id: "u-customer", email: "customer@demo.com", role: "customer", name: "Jiwon Kim" },
      { id: "u-dealer1", email: "dealer@demo.com", role: "dealer", name: "LA Diamond Atelier", active: true },
      { id: "u-dealer2", email: "dealer2@demo.com", role: "dealer", name: "Bay Area Gems", active: true },
    ],
    diamonds: [
      { id: "d-1", shape: "round", carat: 1.0, cut: "Excellent", color: "D", clarity: "VVS1", certOrg: "IGI", certNo: "IGI-588301244", priceUsd: 1400, visible: true, media: [{ kind: "image", src: TWEEZERS }, { kind: "video", src: NOIR_VIDEO }] },
      { id: "d-2", shape: "round", carat: 1.5, cut: "Excellent", color: "E", clarity: "VS1", certOrg: "IGI", certNo: "IGI-588301245", priceUsd: 2450, visible: true, media: [{ kind: "image", src: TWEEZERS }] },
      { id: "d-3", shape: "oval", carat: 1.2, cut: "Excellent", color: "F", clarity: "VVS2", certOrg: "IGI", certNo: "IGI-588301246", priceUsd: 1850, visible: true, media: [{ kind: "image", src: TWEEZERS }] },
      { id: "d-4", shape: "princess", carat: 1.0, cut: "Very Good", color: "E", clarity: "VS2", certOrg: "GIA", certNo: "GIA-2231855700", priceUsd: 1300, visible: true, media: [{ kind: "image", src: TWEEZERS }] },
      { id: "d-5", shape: "emerald", carat: 2.0, cut: "Excellent", color: "F", clarity: "VS1", certOrg: "IGI", certNo: "IGI-588301248", priceUsd: 4500, visible: true, media: [{ kind: "image", src: TWEEZERS }, { kind: "video", src: NOIR_VIDEO }] },
      { id: "d-6", shape: "pear", carat: 1.5, cut: "Excellent", color: "D", clarity: "VVS2", certOrg: "GIA", certNo: "GIA-2231855701", priceUsd: 2750, visible: true, media: [{ kind: "image", src: TWEEZERS }] },
      { id: "d-7", shape: "cushion", carat: 1.0, cut: "Very Good", color: "G", clarity: "SI1", certOrg: "IGI", certNo: "IGI-588301250", priceUsd: 950, visible: true, media: [{ kind: "image", src: TWEEZERS }] },
      { id: "d-8", shape: "marquise", carat: 0.9, cut: "Excellent", color: "E", clarity: "VS1", certOrg: "IGI", certNo: "IGI-588301251", priceUsd: 1100, visible: true, media: [{ kind: "image", src: TWEEZERS }] },
      { id: "d-9", shape: "radiant", carat: 1.8, cut: "Excellent", color: "F", clarity: "VS2", certOrg: "IGI", certNo: "IGI-588301252", priceUsd: 3300, visible: true, media: [{ kind: "image", src: TWEEZERS }] },
      { id: "d-10", shape: "asscher", carat: 1.3, cut: "Excellent", color: "E", clarity: "VVS1", certOrg: "GIA", certNo: "GIA-2231855702", priceUsd: 2400, visible: true, media: [{ kind: "image", src: TWEEZERS }] },
      { id: "d-11", shape: "heart", carat: 1.0, cut: "Very Good", color: "F", clarity: "VS1", certOrg: "IGI", certNo: "IGI-588301254", priceUsd: 1500, visible: true, media: [{ kind: "image", src: TWEEZERS }] },
      { id: "d-12", shape: "round", carat: 2.0, cut: "Excellent", color: "D", clarity: "IF", certOrg: "IGI", certNo: "IGI-588301255", priceUsd: 6450, visible: true, media: [{ kind: "image", src: TWEEZERS }, { kind: "video", src: NOIR_VIDEO }] },
    ],
    poolDiamonds: [
      // 기본 벤더 u-supplier1 — round/1.5/E/VS1/CVD 인테이크가 자동 매칭되도록
      { id: "POOL-000001", supplierId: "u-supplier1", igiNo: "IGI-LG-700001", shape: "round", carat: 1.5, color: "D", clarity: "VVS1", growth: "CVD", lab: "IGI", certOrg: "IGI", reportUrl: "", proportions: {}, colorTreatment: "disclosed", media: [{ kind: "image", src: TWEEZERS }], procurementCostUsd: 500, availability: "available", archived: false, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
      { id: "POOL-000002", supplierId: "u-supplier1", igiNo: "IGI-LG-700002", shape: "round", carat: 1.6, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", certOrg: "IGI", reportUrl: "", proportions: {}, colorTreatment: "disclosed", media: [{ kind: "image", src: TWEEZERS }, { kind: "video", src: NOIR_VIDEO }], procurementCostUsd: 520, availability: "available", archived: false, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
      { id: "POOL-000003", supplierId: "u-supplier1", igiNo: "IGI-LG-700003", shape: "round", carat: 1.5, color: "E", clarity: "IF", growth: "CVD", lab: "IGI", certOrg: "IGI", reportUrl: "", proportions: {}, colorTreatment: "disclosed", media: [{ kind: "image", src: TWEEZERS }], procurementCostUsd: 540, availability: "available", archived: false, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
      // 매칭 제외 데모: 컬러 낮음(G)
      { id: "POOL-000004", supplierId: "u-supplier1", igiNo: "IGI-LG-700004", shape: "round", carat: 1.5, color: "G", clarity: "VS1", growth: "CVD", lab: "IGI", certOrg: "IGI", reportUrl: "", proportions: {}, colorTreatment: "disclosed", media: [{ kind: "image", src: TWEEZERS }], procurementCostUsd: 460, availability: "available", archived: false, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
      { id: "POOL-000005", supplierId: "u-supplier2", igiNo: "IGI-LG-700005", shape: "round", carat: 1.55, color: "E", clarity: "VVS2", growth: "CVD", lab: "IGI", certOrg: "IGI", reportUrl: "", proportions: {}, colorTreatment: "disclosed", media: [{ kind: "image", src: TWEEZERS }], procurementCostUsd: 530, availability: "available", archived: false, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
      // 다른 셰이프 — 오벌 주문용
      { id: "POOL-000006", supplierId: "u-supplier2", igiNo: "IGI-LG-700006", shape: "oval", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", certOrg: "IGI", reportUrl: "", proportions: {}, colorTreatment: "disclosed", media: [{ kind: "image", src: TWEEZERS }], procurementCostUsd: 510, availability: "available", archived: false, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
      // 성장 HPHT + 캐럿 초과 데모
      { id: "POOL-000007", supplierId: "u-supplier2", igiNo: "IGI-LG-700007", shape: "emerald", carat: 2.0, color: "F", clarity: "VS1", growth: "HPHT", lab: "IGI", certOrg: "IGI", reportUrl: "", proportions: {}, colorTreatment: "disclosed", media: [{ kind: "image", src: TWEEZERS }], procurementCostUsd: 900, availability: "available", archived: false, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
    ],
    // ---------- Operations Manual 도메인 ----------
    // 시퀀스 카운터는 시드된 모든 6자리 seq id(DM/POOL 등)보다 커야 충돌 없음 — 풀 시드가 POOL-000007까지 쓰므로 ≥7.
    opsCounter: 7,
    intakes: [
      { id: "IN-000001", orderId: "DM-000001", name: "Jiwon Kim", contact: "customer@demo.com", productLine: "solitaire", category: "ring",
        styleId: "RING-001", budget: 4500, metal: "18kw", conditional: { ringSize: "6 US" },
        stonePrefs: { shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI India", colorTreatment: "disclosed", fluorescence: "none", lwRatio: "" },
        requiredDate: "2026-08-15", country: "USA", termsAccepted: true,
        referenceMedia: [
          { id: "REF-000001", kind: "image", src: "/assets/lineup-band.png", status: "approved",
            annotations: [{ pinId: 1, x: 50, y: 30, part: "prong", chipKey: "prong6" }] },
          // 모니터링에서 숨김 처리된 예시 — 벤더 브리프에서 제외된다
          { id: "REF-000002", kind: "image", src: "/assets/lineup-pendant.png", status: "hidden", annotations: [] },
        ],
        createdAt: "2026-06-08T09:00:00.000Z" },
      { id: "IN-000002", orderId: "DM-000002", name: "Noah Lee", contact: "+1 213-555-0188", productLine: "multi", category: "necklace",
        styleId: "NECK-001", budget: 2600, metal: "18ky", conditional: { chainStyle: "cable", chainLength: "18in", clasp: "lobster" },
        stonePrefs: null, requiredDate: "2026-07-30", country: "USA", termsAccepted: true, referenceMedia: [], createdAt: "2026-06-05T10:00:00.000Z" },
      // 리뷰 플로우 테스트용 — 배송 완료 데모 주문
      { id: "IN-000003", orderId: "DM-000003", name: "Mina Choi", contact: "mina@demo.com", productLine: "solitaire", category: "ring",
        styleId: "RING-001", metal: "18kw", conditional: { ringSize: "6" },
        stonePrefs: { shape: "round", carat: 1.2, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI India", colorTreatment: "disclosed", fluorescence: "none", lwRatio: "" },
        requiredDate: "2026-06-20", country: "USA", termsAccepted: true, referenceMedia: [], createdAt: "2026-05-10T09:00:00.000Z" },
    ],
    opsOrders: [
      { id: "DM-000001", intakeId: "IN-000001", customerId: "u-customer", customerName: "Jiwon Kim", styleId: "RING-001",
        status: "STONE_SELECTION", owner: "Operations", queryCode: "QX7K-M9P2", selectedDiamondId: null,
        requiredDate: "2026-08-15", internalNotes: "Comfortable lead time. Prefers 1.5ct E/VS1.", createdAt: "2026-06-08T09:10:00.000Z" },
      { id: "DM-000002", intakeId: "IN-000002", customerId: null, customerName: "Noah Lee", styleId: "NECK-001",
        status: "PRODUCTION", owner: "Operations", queryCode: "H3WT-8RVK", selectedDiamondId: null,
        requiredDate: "2026-07-30", internalNotes: "Multi-stone — melee spec confirmed", createdAt: "2026-06-05T10:20:00.000Z" },
      { id: "DM-000003", intakeId: "IN-000003", customerId: null, customerName: "Mina Choi", styleId: "RING-001",
        status: "DELIVERED", owner: "Operations", queryCode: "RV4D-7TQ2", selectedDiamondId: null,
        requiredDate: "2026-06-20", internalNotes: "Delivered demo — review flow testing", createdAt: "2026-05-10T09:10:00.000Z" },
    ],
    opsStyles: styleSeedData.map((style) => ({
      ...style,
      productLine: STYLE_PRODUCT_LINE[style.id] || style.productLine || null,
    })),
    styleSpecs: [
      { id: "SPEC-000001", styleId: "NECK-001", metal: "18ky", size: "18in", centerStoneSpec: "standard center stone",
        estWeightG: 4.2, variancePct: 6, laborUsd: 75, materialsUsd: 30, status: "approved", evidence: "supplier quote 2026-05-15" },
      { id: "SPEC-000002", styleId: "RING-001", metal: "18kw", size: "6 US", centerStoneSpec: "1.5ct round",
        estWeightG: 4.2, variancePct: 6, laborUsd: 85, materialsUsd: 25, status: "approved", evidence: "supplier quote 2026-05-10" },
    ],
    diamondPricing: defaultBenchmark(),
    chipCatalog: defaultChipCatalog(),
    procurementReqs: [
      { id: "PR-000001", orderId: "DM-000001", type: "diamondCandidates", supplierId: "u-supplier1",
        dueDate: "2026-06-14", batchValidUntil: daysFromNow(5), brief: "1.4-1.6ct round, D-F, VS1+, CVD, IGI. 10-20 candidates.",
        metal: null, measurements: null, status: "submitted", result: null, createdAt: "2026-06-09T09:00:00.000Z" },
      { id: "PR-000002", orderId: "DM-000002", type: "cad", supplierId: "u-supplier1",
        dueDate: "2026-06-13", batchValidUntil: null, brief: "NECK-001 18KY 18in standard center — 3D CAD",
        metal: "18ky", measurements: "chain 18in", status: "submitted", result: null, createdAt: "2026-06-10T09:00:00.000Z" },
    ],
    diamondCands: [
      { id: "DIA-DM-000001-01", orderId: "DM-000001", prId: "PR-000001", igiNo: "LG591234001", shape: "round", carat: 1.50,
        color: "E", clarity: "VS1", growth: "CVD", lab: "IGI India",
        proportions: { table: 57, depth: 62.4, crown: 35, pavilion: 40.8, lw: 1.0, faceUp: "7.3mm" },
        reportUrl: "", image: TWEEZERS, video: NOIR_VIDEO, colorTreatment: "disclosed", availability: "available",
        procurementCostUsd: 500, supplierId: "u-supplier1", internalReview: "recommended", internalNotes: "Excellent proportions",
        published: true, customerPriceUsd: 1180, clientSelection: "none", locked: false, createdAt: "2026-06-10T11:00:00.000Z" },
      { id: "DIA-DM-000001-02", orderId: "DM-000001", prId: "PR-000001", igiNo: "LG591234002", shape: "round", carat: 1.52,
        color: "D", clarity: "VS1", growth: "CVD", lab: "IGI India",
        proportions: { table: 56, depth: 61.9, crown: 34.5, pavilion: 40.6, lw: 1.0, faceUp: "7.35mm" },
        reportUrl: "", image: TWEEZERS, video: "", colorTreatment: "disclosed", availability: "available",
        procurementCostUsd: 520, supplierId: "u-supplier1", internalReview: "alternate", internalNotes: "",
        published: true, customerPriceUsd: 1260, clientSelection: "none", locked: false, createdAt: "2026-06-10T11:00:00.000Z" },
      { id: "DIA-DM-000001-03", orderId: "DM-000001", prId: "PR-000001", igiNo: "LG591234003", shape: "round", carat: 1.45,
        color: "F", clarity: "VS2", growth: "CVD", lab: "IGI India",
        proportions: { table: 58, depth: 62.8, crown: 35.5, pavilion: 41, lw: 1.0, faceUp: "7.2mm" },
        reportUrl: "", image: TWEEZERS, video: "", colorTreatment: "disclosed", availability: "available",
        procurementCostUsd: 460, supplierId: "u-supplier1", internalReview: "excluded", internalNotes: "Depth too high — small face-up",
        published: false, customerPriceUsd: null, clientSelection: "none", locked: false, createdAt: "2026-06-10T11:00:00.000Z" },
    ],
    quotes: [
      { id: "Q-DM-000002-V1", orderId: "DM-000002", version: 1, status: "accepted",
        estWeightG: 4.2, metalRefUsdPerG: 95, lossRatePct: 8, nonMetalUsd: 320,
        internal: { diamondCostUsd: 380, laborUsd: 75, extrasUsd: 60, riskUsd: 40, multiplier: 1.8 },
        snapshot: { benchmarkUsdPerCt: 224, carat: 1.0 },
        diamondAmountUsd: 403, metalAmountUsd: 431, totalUsd: 1154, depositUsd: 577, balanceUsd: 577,
        validUntil: "2026-06-20", leadDays: 10, acceptedAt: "2026-06-10T15:00:00.000Z", createdAt: "2026-06-09T15:00:00.000Z" },
    ],
    milestones: [
      { id: "M-DM-000002-01", orderId: "DM-000002", stage: "depositReceived", status: "done", clientUpdate: "", clientAction: "", link: "", publishToClient: true, at: "2026-06-10T16:00:00.000Z" },
      // 새 flow: 디자인은 제품 초안에서 승인 — CAD는 기록으로 남고 제작이 바로 진행된다
      { id: "M-DM-000002-03", orderId: "DM-000002", stage: "cadIssued", status: "done", clientUpdate: "CAD V1", clientAction: "", link: "", publishToClient: true, at: "2026-06-11T10:00:00.000Z" },
      { id: "M-DM-000002-04", orderId: "DM-000002", stage: "productionStarted", status: "inProgress", clientUpdate: "", clientAction: "", link: "", publishToClient: true, at: "2026-06-11T10:00:00.000Z" },
    ],
    cadReviews: [
      { id: "CADR-000001", orderId: "DM-000002", version: 1, fileUrl: "/assets/concept-lumina-lab.webp",
        supplierUploadedAt: "2026-06-11T09:30:00.000Z", internalReview: "Dimensions check passed", sentAt: "2026-06-11T10:00:00.000Z",
        decision: "approved", feedback: [], confirmedMeasurements: "", evidence: "", decidedAt: "2026-06-11T10:00:00.000Z" },
    ],
    customerActions: [
      { id: "CA-000001", orderId: "DM-000001", type: "diamondSelection", prompt: "Select a center stone from candidates", link: "", dueDate: "2026-06-20", status: "open", response: null, respondedAt: null, createdAt: "2026-06-10T12:00:00.000Z" },
    ],
    conversations: [
      { id: "CONV-000001", orderId: "DM-000001", channel: "web", externalThreadId: "", sourceLabel: "", status: "waitingOps", createdAt: "2026-06-10T13:00:00.000Z", updatedAt: "2026-06-10T13:00:00.000Z", lastMessageAt: "2026-06-10T13:00:00.000Z" },
    ],
    conversationMessages: [
      { id: "MSG-000001", orderId: "DM-000001", conversationId: "CONV-000001", channel: "web", externalThreadId: "", actorRole: "customer", actorId: "guest", body: "Can I compare these stones before choosing?", attachments: [], sourceLabel: "", createdAt: "2026-06-10T13:00:00.000Z" },
    ],
    auditLog: [
      { id: "aud-1", actor: "ops", entity: "order", entityId: "DM-000001", field: "create", before: null, after: "STONE_SELECTION", at: "2026-06-08T09:10:00.000Z" },
      { id: "aud-2", actor: "ops", entity: "order", entityId: "DM-000002", field: "status", before: "QUOTATION", after: "CAD", at: "2026-06-10T16:00:00.000Z" },
    ],
    // ---------- 딜러 네트워크 (diamond_qc.pdf) ----------
    dealerProfiles: [
      { userId: "u-dealer1", tier: 1, city: "Los Angeles, CA", permitNo: "CA-SP-104551", resaleCertNo: "SR-AP-22-781504", active: true, tierOverride: null },
      { userId: "u-dealer2", tier: 2, city: "San Francisco, CA", permitNo: "CA-SP-118209", resaleCertNo: "SR-AP-23-440912", active: true, tierOverride: null },
    ],
    dealerApplications: [
      { id: "app-1", bizName: "Seattle Fine Jewelry", city: "Seattle, WA", contactName: "Daniel Kim", email: "daniel@sfj.example", permitNo: "WA-SP-90211", resaleCertNo: "", expectedQuarterlyUsd: 15000, status: "pending", createdAt: "2026-06-10T18:00:00.000Z" },
    ],
    // 완제품 도매 SKU — 이미지는 lineup-*.png, MSRP는 소매 권장가
    catalogItems: [
      { id: "c-ring", category: "ring", image: "/assets/lineup-ring.png", msrpUsd: 1690, stoneWholesaleT1: 750, stoneWholesaleT2: 850, metalGrams: 4.2, laborUsd: 55, resizable: true, visible: true,
        name: { ko: "BeloveD 솔리테어 링 1.0ct", en: "BeloveD Solitaire Ring 1.0ct", zh: "BeloveD 单钻戒 1.0ct", es: "Anillo solitario BeloveD 1.0ct" } },
      { id: "c-band", category: "ring", image: "/assets/lineup-band.png", msrpUsd: 1290, stoneWholesaleT1: 580, stoneWholesaleT2: 650, metalGrams: 3.8, laborUsd: 65, resizable: false, visible: true,
        name: { ko: "이터니티 다이아 밴드", en: "Eternity Band Ring", zh: "Eternity 排钻戒圈", es: "Anillo Eternity Band" } },
      { id: "c-pendant", category: "necklace", image: "/assets/lineup-pendant.png", msrpUsd: 990, stoneWholesaleT1: 420, stoneWholesaleT2: 480, metalGrams: 3.0, laborUsd: 45, resizable: true, visible: true,
        name: { ko: "BeloveD 펜던트 1.0ct", en: "BeloveD Pendant 1.0ct", zh: "BeloveD 吊坠 1.0ct", es: "Colgante BeloveD 1.0ct" } },
      { id: "c-studs", category: "earring", image: "/assets/lineup-studs.png", msrpUsd: 840, stoneWholesaleT1: 360, stoneWholesaleT2: 410, metalGrams: 2.4, laborUsd: 40, resizable: true, visible: true,
        name: { ko: "클래식 스터드 이어링 1.0ct", en: "Classic Stud Earrings 1.0ct", zh: "经典钻石耳钉 1.0ct", es: "Aretes clásicos 1.0ct" } },
      { id: "c-bracelet", category: "bracelet", image: "/assets/lineup-bracelet.png", msrpUsd: 1990, stoneWholesaleT1: 950, stoneWholesaleT2: 1080, metalGrams: 9.6, laborUsd: 95, resizable: true, visible: true,
        name: { ko: "테니스 브레이슬릿", en: "Tennis Bracelet", zh: "Tennis 钻石手链", es: "Pulsera tenis" } },
    ],
    wholesaleOrders: [
      { id: "wo-1", dealerId: "u-dealer1", goldSpotAtOrder: 85,
        items: [
          { itemId: "c-bracelet", qty: 10, stoneUsd: 950, metalUsd: 707, unitUsd: 1657 },
          { itemId: "c-ring", qty: 5, stoneUsd: 750, metalUsd: 323, unitUsd: 1073 },
        ],
        shipTo: { type: "dealer", name: "LA Diamond Atelier", address: "550 S Hill St #900, Los Angeles, CA" },
        status: "DELIVERED", qcPhotos: ["/assets/lab-diamond-tweezers.webp"], trackingNo: "1Z45X990318842",
        totalUsd: 21935, createdAt: "2026-05-20T17:00:00.000Z" },
      { id: "wo-2", dealerId: "u-dealer1", goldSpotAtOrder: 85,
        items: [{ itemId: "c-pendant", qty: 2, stoneUsd: 420, metalUsd: 236, unitUsd: 656 }],
        shipTo: { type: "endBuyer", name: "Emma Park", address: "1822 Sawtelle Blvd, Los Angeles, CA" },
        status: "PLACED", qcPhotos: [], trackingNo: null,
        totalUsd: 1312, createdAt: "2026-06-09T20:00:00.000Z" },
      { id: "wo-3", dealerId: "u-dealer2", goldSpotAtOrder: 85,
        items: [{ itemId: "c-studs", qty: 2, stoneUsd: 410, metalUsd: 193, unitUsd: 603 }],
        shipTo: { type: "dealer", name: "Bay Area Gems", address: "888 Brannan St, San Francisco, CA" },
        status: "SHIPPED", qcPhotos: ["/assets/lineup-studs.png"], trackingNo: "1Z45X990321001",
        totalUsd: 1206, createdAt: "2026-06-05T19:30:00.000Z" },
    ],
    warrantyRegs: [
      { id: "wr-1", dealerId: "u-dealer1", itemId: "c-bracelet", orderId: "wo-1", buyerName: "Emma Park", buyerContact: "emma.p@example.com", soldAt: "2026-05-28", warrantyUntil: "2027-05-28" },
      { id: "wr-2", dealerId: "u-dealer1", itemId: "c-ring", orderId: "wo-1", buyerName: "Noah Lee", buyerContact: "+1 213-555-0188", soldAt: "2026-06-02", warrantyUntil: "2027-06-02" },
    ],
    claims: [
      { id: "cl-1", dealerId: "u-dealer1", regId: "wr-1", defectType: "plating", desc: "Rhodium plating wore off within 2 weeks (normal wear)", photos: ["/assets/lineup-bracelet.png"], status: "SUBMITTED", adminNote: "", salvage: null, createdAt: "2026-06-11T15:00:00.000Z" },
    ],
    salvageLedger: [],
    // 고객 리뷰 — 인증샷 미디어 퍼스트, 어드민 검수(published) 후 홈 노출
    reviews: [
      { id: "REV-000007", orderId: "DM-000003", name: "Mina C.", location: "Los Angeles", rating: 5,
        quote: "Bought the whole set here — obsessed.", body: "Pendant, drops and the stack — everything came out so pretty in person. I keep catching myself staring at them.",
        media: [
          { kind: "image", src: "/assets/reviews/ugc-232616.jpg" },
          { kind: "image", src: "/assets/reviews/ugc-232639.jpg" },
          { kind: "image", src: "/assets/reviews/ugc-232645.jpg" },
        ],
        status: "published", createdAt: "2026-06-30T10:00:00.000Z" },
      { id: "REV-000001", orderId: "DM-000002", name: "Jiwon K.", location: "Los Angeles", rating: 5,
        quote: "She said yes.", body: "The proposal video made me cry — the ring is unreal in person.",
        media: [{ kind: "video", src: "/assets/diamond-hero-white.mp4" }, { kind: "image", src: "/assets/designs/RIGTXR09875R400-WG-RB-WH-400-M0.jpg" }],
        status: "published", createdAt: "2026-06-18T10:00:00.000Z" },
      { id: "REV-000002", orderId: "DM-000002", name: "Noah L.", location: "Seattle", rating: 5,
        quote: "Better than the render.", body: "CAD to hand in four weeks. The finish is flawless.",
        media: [{ kind: "image", src: "/assets/designs/RIGTXR01745-WG-RB-WH-150-M0.jpg" }],
        status: "published", createdAt: "2026-06-15T10:00:00.000Z" },
      { id: "REV-000003", orderId: "DM-000002", name: "Emma S.", location: "New York", rating: 5,
        quote: "Icy white. No yellow.", body: "Exactly the color I asked for — they sent the IGI video before I paid a cent.",
        media: [{ kind: "image", src: "/assets/designs/RIGKSR6117R600-WG-RB-WH-700-M0.jpg" }],
        status: "published", createdAt: "2026-06-12T10:00:00.000Z" },
      { id: "REV-000004", orderId: "DM-000002", name: "Sofia M.", location: "Miami", rating: 5,
        quote: "Everyday studs, forever.", body: "Half the retail quote for a better stone.",
        media: [{ kind: "image", src: "/assets/designs/AJE06021-WG-M0.jpg" }],
        status: "published", createdAt: "2026-06-10T10:00:00.000Z" },
      { id: "REV-000005", orderId: "DM-000002", name: "Hana P.", location: "San Francisco", rating: 5,
        quote: "Tennis dream, half retail.", body: "The bracelet I kept screenshotting for years.",
        media: [{ kind: "image", src: "/assets/designs/BCGTXBR00769-YG-RB-WH-1200-M0.jpg" }],
        status: "published", createdAt: "2026-06-08T10:00:00.000Z" },
      { id: "REV-000006", orderId: "DM-000002", name: "Daniel R.", location: "Chicago", rating: 5,
        quote: "She wears it every day.", body: "Anniversary pendant — packaging alone felt like a maison.",
        media: [{ kind: "image", src: "/assets/designs/EAGTXE02083-RG-EM-WH-250-M0.jpg" }],
        status: "published", createdAt: "2026-06-05T10:00:00.000Z" },
    ],
    // shippingStages는 키 — 라벨은 translations.js platform.stages에서 언어별 매핑
    settings: {
      goldSpotPerGram: 85, goldPurity: 0.75, tierThresholdUsd: 20000, warrantyMonths: 12, cosmeticWindowDays: 7,
      // Operations Manual
      opsDepositRate: 0.5, opsMultiplier: 1.8, defaultLossRatePct: 8, productionLeadDays: 10,
      metalRefUsdPerG: { "14ky": 62, "18ky": 80, "14kr": 62, "18kr": 80, "18kw": 85, "pt": 38 },
      // 쿠폰 카탈로그 — 어드민 콘솔에서 등록/삭제/만료 관리, 서버 settings로 write-through
      coupons: BASE_COUPONS.map((c) => ({ ...c })),
      designChangeFeeUsd: 15, cancelAfterProductionMinUsd: 140, freeMinorRevisions: 1,
      // 어드민 최소 개입 자동화: 전 주문이 기본 벤더로 자동 매칭 (스타일별 supplierId로 오버라이드 가능)
      defaultSupplierId: "u-supplier1", autoDueDays: 3, batchValidDays: 10,
      stockConfirmWithinDays: 3, // 배치 만료가 이 일수 이내일 때만 벤더 재고확인 요청 (그 외엔 자동 락)
      poolCaratUnder: 0.05, poolCaratOver: 0.4, poolMatchLimit: 12, // 풀 자동매칭 허용 캐럿범위·후보 캡
      showSampleLibrary: true, // 데모용 샘플 이미지 라이브러리 노출 (실서비스에선 false)
      shipToAddress: "BeloveD Receiving, 550 S Hill St #1100, Los Angeles, CA 90013",
      // 디파짓/잔금 수동 확인 결제 채널 — 실계좌는 서버 settings(/v1/settings/public)가 유일한 소스.
      // 클라이언트 프로토타입 시드에는 실핸들을 넣지 않는다 (공개 번들 노출 방지).
      payment: { zelle: "", venmo: "", note: "" },
      paymentChannelsVersion: 1,
      reviewsSeedVersion: 3,
      demoDeliveredSeedVersion: 1,
    },
  };
}
