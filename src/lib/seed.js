import { defaultBenchmark } from "./ops.js";
import { defaultChipCatalog } from "./chips.js";

const TWEEZERS = "/assets/lab-diamond-tweezers.png";
const NOIR_VIDEO = "/assets/diamond-noir-white.mp4";

// 샘플 사진: jewelry-lineup.png에서 제품별로 잘라낸 단독 이미지 (잘림 없음)
const lineup = (name) => ({ kind: "image", src: `/assets/lineup-${name}.png` });

// shape/metal/배송단계는 키로 저장하고 언어별 라벨은 translations.js에서 매핑한다.
export function seed() {
  return {
    counter: 1100,
    users: [
      { id: "u-admin", email: "admin@demo.com", role: "admin", name: "Operations" },
      { id: "u-supplier1", email: "supplier@demo.com", role: "supplier", name: "SUPPLIER-CN-01", active: true },
      { id: "u-supplier2", email: "supplier2@demo.com", role: "supplier", name: "SUPPLIER-CN-02", active: true },
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
    // ---------- Operations Manual 도메인 ----------
    opsCounter: 2,
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
    ],
    opsOrders: [
      { id: "DM-000001", intakeId: "IN-000001", customerId: "u-customer", customerName: "Jiwon Kim", styleId: "RING-001",
        status: "STONE_SELECTION", owner: "Operations", queryCode: "QX7K-M9P2", selectedDiamondId: null,
        requiredDate: "2026-08-15", internalNotes: "Comfortable lead time. Prefers 1.5ct E/VS1.", createdAt: "2026-06-08T09:10:00.000Z" },
      { id: "DM-000002", intakeId: "IN-000002", customerId: null, customerName: "Noah Lee", styleId: "NECK-001",
        status: "CAD", owner: "Operations", queryCode: "H3WT-8RVK", selectedDiamondId: null,
        requiredDate: "2026-07-30", internalNotes: "Multi-stone — melee spec confirmed", createdAt: "2026-06-05T10:20:00.000Z" },
    ],
    opsStyles: [
      { id: "RING-001", category: "ring", coverImage: "/assets/lineup-ring.png", mediaComplete: true,
        metalOptions: ["18kw", "18ky", "pt"], estWeightG: 4.2, laborUsd: 85, leadDays: 10,
        availableForSale: true, published: true, supplierEvidence: "Supplier quote 2026-05", firstQuoteAt: "2026-05-10",
        name: { ko: "솔리테어 링 (6프롱)", en: "Solitaire Ring (6-prong)", zh: "六爪单钻戒", es: "Anillo solitario (6 garras)" } },
      { id: "RING-002", category: "ring", coverImage: "/assets/lineup-band.png", mediaComplete: true,
        metalOptions: ["18kw", "18ky", "18kr"], estWeightG: 3.8, laborUsd: 110, leadDays: 12,
        availableForSale: true, published: true, supplierEvidence: "", firstQuoteAt: "2026-05-12",
        name: { ko: "이터니티 밴드", en: "Eternity Band", zh: "永恒排钻戒", es: "Anillo Eternity" } },
      { id: "NECK-001", category: "necklace", coverImage: "/assets/lineup-pendant.png", mediaComplete: true,
        metalOptions: ["18ky", "18kw", "pt"], estWeightG: 4.2, laborUsd: 75, leadDays: 10,
        availableForSale: true, published: true, supplierEvidence: "Manual example spec", firstQuoteAt: "2026-05-15",
        name: { ko: "솔리테어 펜던트", en: "Solitaire Pendant", zh: "单钻吊坠", es: "Colgante solitario" } },
      { id: "EARR-001", category: "earrings", coverImage: "/assets/lineup-studs.png", mediaComplete: true,
        metalOptions: ["14ky", "18ky", "18kw"], estWeightG: 2.4, laborUsd: 70, leadDays: 9,
        availableForSale: true, published: true, supplierEvidence: "", firstQuoteAt: "2026-05-18",
        name: { ko: "클래식 스터드", en: "Classic Studs", zh: "经典耳钉", es: "Aretes clásicos" } },
      { id: "BRAC-001", category: "bangle", coverImage: "/assets/lineup-bracelet.png", mediaComplete: true,
        metalOptions: ["18kw", "18ky"], estWeightG: 9.6, laborUsd: 160, leadDays: 14,
        availableForSale: true, published: true, supplierEvidence: "", firstQuoteAt: "2026-05-20",
        name: { ko: "테니스 브레이슬릿", en: "Tennis Bracelet", zh: "Tennis 手链", es: "Pulsera tenis" } },
      { id: "RING-003", category: "ring", coverImage: "/assets/freestyle-trump.mp4", mediaComplete: false,
        metalOptions: ["18kw"], estWeightG: 5.0, laborUsd: 240, leadDays: 18,
        availableForSale: true, published: true, supplierEvidence: "Custom cutting demo", firstQuoteAt: "2026-06-01",
        name: { ko: "프리스타일 커스텀 커팅", en: "Freestyle Custom Cut", zh: "自由定制切割", es: "Talla personalizada" } },
    ],
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
        dueDate: "2026-06-14", batchValidUntil: "2026-06-22", brief: "1.4-1.6ct round, D-F, VS1+, CVD, IGI. 10-20 candidates.",
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
        procurementCostUsd: 540, supplierId: "u-supplier1", internalReview: "recommended", internalNotes: "Excellent proportions",
        published: true, customerPriceUsd: 1180, clientSelection: "none", locked: false, createdAt: "2026-06-10T11:00:00.000Z" },
      { id: "DIA-DM-000001-02", orderId: "DM-000001", prId: "PR-000001", igiNo: "LG591234002", shape: "round", carat: 1.52,
        color: "D", clarity: "VS1", growth: "CVD", lab: "IGI India",
        proportions: { table: 56, depth: 61.9, crown: 34.5, pavilion: 40.6, lw: 1.0, faceUp: "7.35mm" },
        reportUrl: "", image: TWEEZERS, video: "", colorTreatment: "disclosed", availability: "available",
        procurementCostUsd: 580, supplierId: "u-supplier1", internalReview: "alternate", internalNotes: "",
        published: true, customerPriceUsd: 1260, clientSelection: "none", locked: false, createdAt: "2026-06-10T11:00:00.000Z" },
      { id: "DIA-DM-000001-03", orderId: "DM-000001", prId: "PR-000001", igiNo: "LG591234003", shape: "round", carat: 1.45,
        color: "F", clarity: "VS2", growth: "CVD", lab: "IGI India",
        proportions: { table: 58, depth: 62.8, crown: 35.5, pavilion: 41, lw: 1.0, faceUp: "7.2mm" },
        reportUrl: "", image: TWEEZERS, video: "", colorTreatment: "disclosed", availability: "available",
        procurementCostUsd: 470, supplierId: "u-supplier1", internalReview: "excluded", internalNotes: "Depth too high — small face-up",
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
      { id: "M-DM-000002-03", orderId: "DM-000002", stage: "cadIssued", status: "waitingClient", clientUpdate: "CAD V1 ready for review", clientAction: "Check chain length 18in / pendant connection", link: "", publishToClient: true, at: "2026-06-11T10:00:00.000Z" },
    ],
    cadReviews: [
      { id: "CADR-000001", orderId: "DM-000002", version: 1, fileUrl: "/assets/concept-lumina-lab.png",
        supplierUploadedAt: "2026-06-11T09:30:00.000Z", internalReview: "Dimensions check passed", sentAt: "2026-06-11T10:00:00.000Z",
        decision: null, feedback: [], confirmedMeasurements: "", evidence: "", decidedAt: null },
    ],
    customerActions: [
      { id: "CA-000001", orderId: "DM-000001", type: "diamondSelection", prompt: "Select a center stone from candidates", link: "", dueDate: "2026-06-20", status: "open", response: null, respondedAt: null, createdAt: "2026-06-10T12:00:00.000Z" },
      { id: "CA-000002", orderId: "DM-000002", type: "cadReview", prompt: "CAD V1", link: "", dueDate: "2026-06-15", status: "open", response: null, respondedAt: null, createdAt: "2026-06-11T10:00:00.000Z" },
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
        name: { ko: "루미나 솔리테어 링 1.0ct", en: "Lumina Solitaire Ring 1.0ct", zh: "Lumina 单钻戒 1.0ct", es: "Anillo solitario Lumina 1.0ct" } },
      { id: "c-band", category: "ring", image: "/assets/lineup-band.png", msrpUsd: 1290, stoneWholesaleT1: 580, stoneWholesaleT2: 650, metalGrams: 3.8, laborUsd: 65, resizable: false, visible: true,
        name: { ko: "이터니티 다이아 밴드", en: "Eternity Band Ring", zh: "Eternity 排钻戒圈", es: "Anillo Eternity Band" } },
      { id: "c-pendant", category: "necklace", image: "/assets/lineup-pendant.png", msrpUsd: 990, stoneWholesaleT1: 420, stoneWholesaleT2: 480, metalGrams: 3.0, laborUsd: 45, resizable: true, visible: true,
        name: { ko: "루미나 펜던트 1.0ct", en: "Lumina Pendant 1.0ct", zh: "Lumina 吊坠 1.0ct", es: "Colgante Lumina 1.0ct" } },
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
        status: "DELIVERED", qcPhotos: ["/assets/lab-diamond-tweezers.png"], trackingNo: "1Z45X990318842",
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
    // shippingStages는 키 — 라벨은 translations.js platform.stages에서 언어별 매핑
    settings: {
      goldSpotPerGram: 85, goldPurity: 0.75, tierThresholdUsd: 20000, warrantyMonths: 12, cosmeticWindowDays: 7,
      // Operations Manual
      opsDepositRate: 0.5, opsMultiplier: 1.8, defaultLossRatePct: 8, productionLeadDays: 10,
      metalRefUsdPerG: { "14ky": 62, "18ky": 80, "14kr": 62, "18kr": 80, "18kw": 85, "pt": 38 },
      designChangeFeeUsd: 15, cancelAfterProductionMinUsd: 140, freeMinorRevisions: 1,
      // 어드민 최소 개입 자동화: 전 주문이 기본 벤더로 자동 매칭 (스타일별 supplierId로 오버라이드 가능)
      defaultSupplierId: "u-supplier1", autoDueDays: 3, batchValidDays: 10,
      stockConfirmWithinDays: 3, // 배치 만료가 이 일수 이내일 때만 벤더 재고확인 요청 (그 외엔 자동 락)
      showSampleLibrary: true, // 데모용 샘플 이미지 라이브러리 노출 (실서비스에선 false)
      shipToAddress: "LUMINA LAB Receiving, 550 S Hill St #1100, Los Angeles, CA 90013",
    },
  };
}
