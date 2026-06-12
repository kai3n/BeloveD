const TWEEZERS = "/assets/lab-diamond-tweezers.png";
const NOIR_VIDEO = "/assets/diamond-noir-white.mp4";

// 샘플 사진: jewelry-lineup.png에서 제품별로 잘라낸 단독 이미지 (잘림 없음)
const lineup = (name) => ({ kind: "image", src: `/assets/lineup-${name}.png` });

// shape/metal/배송단계는 키로 저장하고 언어별 라벨은 translations.js에서 매핑한다.
export function seed() {
  return {
    counter: 1100,
    users: [
      { id: "u-admin", email: "admin@demo.com", role: "admin", name: "운영자" },
      { id: "u-vendor1", email: "vendor@demo.com", role: "vendor", name: "ATELIER-01", active: true },
      { id: "u-vendor2", email: "vendor2@demo.com", role: "vendor", name: "ATELIER-02", active: true },
      { id: "u-customer", email: "customer@demo.com", role: "customer", name: "김지원" },
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
    templates: [
      {
        id: "t-1", category: "ring", basePriceUsd: 530, visible: true, media: [lineup("ring")],
        name: { ko: "아우로라 솔리테어", en: "Aurora Solitaire", zh: "Aurora 单钻戒", es: "Solitario Aurora" },
        desc: {
          ko: "6프롱 클래식 솔리테어. 스톤이 주인공이 되는 가장 순수한 형태.",
          en: "Classic six-prong solitaire. The purest form — the stone takes center stage.",
          zh: "经典六爪单钻戒，最纯粹的形态，让钻石成为主角。",
          es: "Solitario clásico de seis garras. La forma más pura — la piedra es la protagonista.",
        },
      },
      {
        id: "t-2", category: "ring", basePriceUsd: 680, visible: true, media: [lineup("band")],
        name: { ko: "이터니티 밴드", en: "Eternity Band", zh: "永恒排钻戒", es: "Anillo Eternity" },
        desc: {
          ko: "밴드를 따라 흐르는 파베 세팅. 단독 착용과 레이어링 모두.",
          en: "Pavé stones flowing along the band. Wear alone or layered.",
          zh: "沿戒圈流动的密镶钻石，单戴或叠戴皆宜。",
          es: "Pavé que fluye a lo largo del aro. Solo o en capas.",
        },
      },
      {
        id: "t-3", category: "necklace", basePriceUsd: 450, visible: true, media: [lineup("pendant")],
        name: { ko: "루미나 펜던트", en: "Lumina Pendant", zh: "Lumina 吊坠", es: "Colgante Lumina" },
        desc: {
          ko: "쇄골 위에 떠 있는 한 점의 빛. 데일리 펜던트의 정석.",
          en: "A single point of light at the collarbone. The definitive daily pendant.",
          zh: "锁骨上的一点光芒，日常吊坠的典范。",
          es: "Un punto de luz sobre la clavícula. El colgante diario por excelencia.",
        },
      },
      {
        id: "t-4", category: "earring", basePriceUsd: 380, visible: true, media: [lineup("studs")],
        name: { ko: "클래식 스터드", en: "Classic Studs", zh: "经典耳钉", es: "Aretes Clásicos" },
        desc: {
          ko: "각도까지 계산된 4프롱 스터드. 매일의 기본.",
          en: "Four-prong studs, engineered to the degree. An everyday essential.",
          zh: "连角度都经过计算的四爪耳钉，每日基本款。",
          es: "Aretes de cuatro garras, calculados al grado. Un básico diario.",
        },
      },
      {
        id: "t-5", category: "bracelet", basePriceUsd: 900, visible: true, media: [lineup("bracelet")],
        name: { ko: "테니스 브레이슬릿", en: "Tennis Bracelet", zh: "Tennis 手链", es: "Pulsera Tenis" },
        desc: {
          ko: "손목을 감싸는 연속된 광채.",
          en: "Continuous brilliance around the wrist.",
          zh: "环绕手腕的连续光辉。",
          es: "Brillo continuo alrededor de la muñeca.",
        },
      },
      {
        id: "t-6", category: "ring", basePriceUsd: 0, visible: true, media: [{ kind: "image", src: "/assets/concept-lumina-lab.png" }],
        name: { ko: "프리스타일 (자유 디자인)", en: "Freestyle (Custom Design)", zh: "自由设计", es: "Diseño Libre" },
        desc: {
          ko: "참고 이미지를 첨부해 원하는 디자인을 자유롭게 의뢰하세요.",
          en: "Attach reference images and commission any design you can imagine.",
          zh: "附上参考图片，自由定制您想要的设计。",
          es: "Adjunta imágenes de referencia y encarga el diseño que imagines.",
        },
      },
    ],
    requests: [
      {
        id: "req-1001", code: "#1001", customerId: "u-customer", templateId: "t-1", diamondId: "d-1",
        details: { metal: "wg18", size: "11", engraving: "J ♥ M", budget: 2300, notes: "최대한 심플하고 가늘게 부탁드려요" },
        status: "PROPOSAL_UPLOADED", vendorId: "u-vendor1",
        createdAt: "2026-06-10T09:00:00.000Z", assignedAt: "2026-06-10T12:00:00.000Z",
      },
    ],
    proposals: [
      { id: "prop-1", requestId: "req-1001", vendorId: "u-vendor1", version: 1, comment: "요청하신 대로 밴드 1.6mm로 제작한 1차 시안입니다.", media: [lineup("ring"), { kind: "image", src: TWEEZERS }], createdAt: "2026-06-11T10:00:00.000Z" },
    ],
    feedback: [],
    orders: [],
    payments: [],
    productionMedia: [],
    statusEvents: [
      { id: "evt-1", refId: "req-1001", from: "DRAFT", to: "SUBMITTED", actorId: "u-customer", at: "2026-06-10T09:00:00.000Z" },
      { id: "evt-2", refId: "req-1001", from: "SUBMITTED", to: "VENDOR_ASSIGNED", actorId: "u-admin", at: "2026-06-10T12:00:00.000Z" },
      { id: "evt-3", refId: "req-1001", from: "VENDOR_ASSIGNED", to: "PROPOSAL_UPLOADED", actorId: "u-vendor1", at: "2026-06-11T10:00:00.000Z" },
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
      { id: "cl-1", dealerId: "u-dealer1", regId: "wr-1", defectType: "plating", desc: "로듐 도금이 2주 만에 벗겨짐 (정상 착용)", photos: ["/assets/lineup-bracelet.png"], status: "SUBMITTED", adminNote: "", salvage: null, createdAt: "2026-06-11T15:00:00.000Z" },
    ],
    salvageLedger: [],
    // shippingStages는 키 — 라벨은 translations.js platform.stages에서 언어별 매핑
    settings: {
      depositRate: 0.3, shippingStages: ["production", "qc", "ready", "shipping", "delivered"],
      goldSpotPerGram: 85, goldPurity: 0.75, tierThresholdUsd: 20000, warrantyMonths: 12, cosmeticWindowDays: 7,
    },
  };
}
