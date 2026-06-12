const LINEUP = "/assets/jewelry-lineup.png";
const TWEEZERS = "/assets/lab-diamond-tweezers.png";
const NOIR_VIDEO = "/assets/diamond-noir-white.mp4";

// 샘플 사진: 기존 자산 재사용. pos가 있으면 jewelry-lineup.png 크롭(5분할)
const crop = (pos) => ({ kind: "image", src: LINEUP, pos });

// shape/metal/배송단계는 키로 저장하고 언어별 라벨은 translations.js에서 매핑한다.
export function seed() {
  return {
    counter: 1100,
    users: [
      { id: "u-admin", email: "admin@demo.com", role: "admin", name: "운영자" },
      { id: "u-vendor1", email: "vendor@demo.com", role: "vendor", name: "ATELIER-01", active: true },
      { id: "u-vendor2", email: "vendor2@demo.com", role: "vendor", name: "ATELIER-02", active: true },
      { id: "u-customer", email: "customer@demo.com", role: "customer", name: "김지원" },
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
        id: "t-1", category: "ring", basePriceUsd: 530, visible: true, media: [crop("0% center")],
        name: { ko: "아우로라 솔리테어", en: "Aurora Solitaire", zh: "Aurora 单钻戒", es: "Solitario Aurora" },
        desc: {
          ko: "6프롱 클래식 솔리테어. 스톤이 주인공이 되는 가장 순수한 형태.",
          en: "Classic six-prong solitaire. The purest form — the stone takes center stage.",
          zh: "经典六爪单钻戒，最纯粹的形态，让钻石成为主角。",
          es: "Solitario clásico de seis garras. La forma más pura — la piedra es la protagonista.",
        },
      },
      {
        id: "t-2", category: "ring", basePriceUsd: 680, visible: true, media: [crop("24% center")],
        name: { ko: "이터니티 밴드", en: "Eternity Band", zh: "永恒排钻戒", es: "Anillo Eternity" },
        desc: {
          ko: "밴드를 따라 흐르는 파베 세팅. 단독 착용과 레이어링 모두.",
          en: "Pavé stones flowing along the band. Wear alone or layered.",
          zh: "沿戒圈流动的密镶钻石，单戴或叠戴皆宜。",
          es: "Pavé que fluye a lo largo del aro. Solo o en capas.",
        },
      },
      {
        id: "t-3", category: "necklace", basePriceUsd: 450, visible: true, media: [crop("50% center")],
        name: { ko: "루미나 펜던트", en: "Lumina Pendant", zh: "Lumina 吊坠", es: "Colgante Lumina" },
        desc: {
          ko: "쇄골 위에 떠 있는 한 점의 빛. 데일리 펜던트의 정석.",
          en: "A single point of light at the collarbone. The definitive daily pendant.",
          zh: "锁骨上的一点光芒，日常吊坠的典范。",
          es: "Un punto de luz sobre la clavícula. El colgante diario por excelencia.",
        },
      },
      {
        id: "t-4", category: "earring", basePriceUsd: 380, visible: true, media: [crop("72% center")],
        name: { ko: "클래식 스터드", en: "Classic Studs", zh: "经典耳钉", es: "Aretes Clásicos" },
        desc: {
          ko: "각도까지 계산된 4프롱 스터드. 매일의 기본.",
          en: "Four-prong studs, engineered to the degree. An everyday essential.",
          zh: "连角度都经过计算的四爪耳钉，每日基本款。",
          es: "Aretes de cuatro garras, calculados al grado. Un básico diario.",
        },
      },
      {
        id: "t-5", category: "bracelet", basePriceUsd: 900, visible: true, media: [crop("100% center")],
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
      { id: "prop-1", requestId: "req-1001", vendorId: "u-vendor1", version: 1, comment: "요청하신 대로 밴드 1.6mm로 제작한 1차 시안입니다.", media: [crop("0% center"), { kind: "image", src: TWEEZERS }], createdAt: "2026-06-11T10:00:00.000Z" },
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
    // shippingStages는 키 — 라벨은 translations.js platform.stages에서 언어별 매핑
    settings: { depositRate: 0.3, shippingStages: ["production", "qc", "ready", "shipping", "delivered"] },
  };
}
