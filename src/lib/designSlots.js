export const DESIGN_CATEGORIES = [
  {
    key: "ring",
    label: "Rings",
    shortLabel: "Ring",
    intro: "Engagement rings, solitaire settings, bands, and statement center-stone pieces.",
    target: 4,
    media: [
      { kind: "image", src: "/assets/lineup-ring.png" },
      { kind: "image", src: "/assets/lineup-band.png" },
      { kind: "video", src: "/assets/freestyle-trump.mp4" },
      { kind: "image", src: "/assets/lab-diamond-tweezers.webp" },
    ],
    names: ["Solitaire Ring", "Eternity Band", "Hidden Halo Ring", "Three-Stone Ring"],
  },
  {
    key: "earrings",
    label: "Earrings",
    shortLabel: "Earrings",
    intro: "Studs, drops, halos, and refined everyday diamond silhouettes.",
    target: 4,
    media: [
      { kind: "image", src: "/assets/lineup-studs.png" },
      { kind: "image", src: "/assets/lab-diamond-tweezers.webp" },
      { kind: "video", src: "/assets/diamond-noir-white.mp4" },
      { kind: "image", src: "/assets/lineup-studs.png" },
    ],
    names: ["Classic Studs", "Halo Studs", "Drop Earrings", "Bezel Studs"],
  },
  {
    key: "bangle",
    label: "Bracelets",
    shortLabel: "Bracelet",
    intro: "Tennis bracelets, bangles, and custom wrist pieces with calibrated stones.",
    target: 4,
    media: [
      { kind: "image", src: "/assets/lineup-bracelet.png" },
      { kind: "video", src: "/assets/diamond-noir-white.mp4" },
      { kind: "image", src: "/assets/lineup-bracelet.png" },
      { kind: "image", src: "/assets/lab-diamond-tweezers.webp" },
    ],
    names: ["Tennis Bracelet", "Diamond Bangle", "Half Tennis Bracelet", "Bezel Bracelet"],
  },
  {
    key: "necklace",
    label: "Necklaces",
    shortLabel: "Necklace",
    intro: "Pendants and chain-led pieces designed around a single stone or matched layout.",
    target: 4,
    media: [
      { kind: "image", src: "/assets/lineup-pendant.png" },
      { kind: "image", src: "/assets/lab-diamond-tweezers.webp" },
      { kind: "video", src: "/assets/diamond-noir-white.mp4" },
      { kind: "image", src: "/assets/lineup-pendant.png" },
    ],
    names: ["Solitaire Pendant", "Bezel Pendant", "Floating Diamond Necklace", "Station Necklace"],
  },
];

export const STYLE_SUBCATEGORIES = {
  ring: ["engagementRing", "weddingBand", "statementRing"],
  earrings: ["studs", "drops", "huggies"],
  bangle: ["tennisBracelet", "bangle", "chainBracelet"],
  necklace: ["pendant", "stationNecklace", "tennisNecklace"],
};

const SAMPLE_STYLE_NAMES = {
  ring: [
    { en: "Solitaire Ring (6-prong)", ko: "솔리테어 링 (6프롱)", zh: "六爪单钻戒", es: "Anillo solitario (6 garras)" },
    { en: "Eternity Band", ko: "이터니티 밴드", zh: "永恒排钻戒", es: "Anillo Eternity" },
    { en: "Freestyle Custom Cut", ko: "프리스타일 커스텀 커팅", zh: "自由定制切割", es: "Talla personalizada" },
    { en: "Three-Stone Ring", ko: "쓰리 스톤 링", zh: "三石戒指", es: "Anillo de tres piedras" },
  ],
  earrings: [
    { en: "Classic Studs", ko: "클래식 스터드", zh: "经典耳钉", es: "Aretes clásicos" },
    { en: "Halo Studs", ko: "헤일로 스터드", zh: "光环耳钉", es: "Aretes halo" },
    { en: "Drop Earrings", ko: "드롭 이어링", zh: "垂坠耳环", es: "Aretes colgantes" },
    { en: "Bezel Studs", ko: "베젤 스터드", zh: "包镶耳钉", es: "Aretes bisel" },
  ],
  bangle: [
    { en: "Tennis Bracelet", ko: "테니스 브레이슬릿", zh: "网球手链", es: "Pulsera tenis" },
    { en: "Diamond Bangle", ko: "다이아몬드 뱅글", zh: "钻石手镯", es: "Brazalete de diamantes" },
    { en: "Half Tennis Bracelet", ko: "하프 테니스 브레이슬릿", zh: "半圈网球手链", es: "Pulsera media tenis" },
    { en: "Bezel Bracelet", ko: "베젤 브레이슬릿", zh: "包镶手链", es: "Pulsera bisel" },
  ],
  necklace: [
    { en: "Solitaire Pendant", ko: "솔리테어 펜던트", zh: "单钻吊坠", es: "Colgante solitario" },
    { en: "Bezel Pendant", ko: "베젤 펜던트", zh: "包镶吊坠", es: "Colgante bisel" },
    { en: "Floating Diamond Necklace", ko: "플로팅 다이아몬드 네크리스", zh: "悬浮钻石项链", es: "Collar diamante flotante" },
    { en: "Station Necklace", ko: "스테이션 네크리스", zh: "间隔钻石项链", es: "Collar station" },
  ],
};

const SAMPLE_STYLE_DEFAULTS = {
  ring: { estWeightG: 4.2, laborUsd: 85, leadDays: 10 },
  earrings: { estWeightG: 2.4, laborUsd: 70, leadDays: 9 },
  bangle: { estWeightG: 9.6, laborUsd: 160, leadDays: 14 },
  necklace: { estWeightG: 4.2, laborUsd: 75, leadDays: 10 },
};

const SAMPLE_DETAIL_COPY = {
  detailLabel: {
    en: "Sample starting point",
    ko: "샘플 시작 디자인",
    zh: "样例起点",
    es: "Punto de partida",
  },
  description: {
    en: "Use this sample as a starting point. Metal, stones, proportions, and finishing can be customized after review.",
    ko: "이 디자인은 시작점입니다. 검토 후 메탈, 스톤, 비율, 마감은 원하는 방향으로 조정할 수 있습니다.",
    zh: "此设计可作为起点。确认需求后，可调整金属、宝石、比例与细节收尾。",
    es: "Usa este diseño como punto de partida. Metal, piedras, proporciones y acabado se pueden ajustar tras revisar tu referencia.",
  },
  flexibleText: {
    en: "Metal, stone, size, profile",
    ko: "메탈, 스톤, 사이즈, 프로필",
    zh: "金属、宝石、尺寸、轮廓",
    es: "Metal, piedra, talla, perfil",
  },
  beforeProductionText: {
    en: "Quote and CAD approval",
    ko: "견적 및 CAD 승인",
    zh: "报价与 CAD 确认",
    es: "Cotización y aprobación CAD",
  },
};

export function categoryMeta(categoryKey) {
  return DESIGN_CATEGORIES.find((category) => category.key === categoryKey);
}

export function subcategoryKeysFor(categoryKey) {
  return STYLE_SUBCATEGORIES[categoryKey] || [];
}

export function defaultSubcategoryFor(categoryKey) {
  return subcategoryKeysFor(categoryKey)[0] || "";
}

export function designSlotId(categoryKey, index) {
  return `${categoryKey}-slot-${index + 1}`;
}

function sampleNameFor(category, index) {
  return SAMPLE_STYLE_NAMES[category.key]?.[index] || { en: category.names[index] || `${category.shortLabel} design` };
}

function styleSearchText(style) {
  if (!style?.name || typeof style.name !== "object") return "";
  return Object.values(style.name).join(" ").toLowerCase();
}

function mediaKey(media) {
  return `${media?.kind || "image"}:${media?.src || ""}`;
}

function cleanMediaList(items) {
  const seen = new Set();
  return (items || [])
    .filter((media) => media?.src)
    .filter((media) => {
      const key = mediaKey(media);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

function styleMediaGallery(style, category, index = 0) {
  const explicitMedia = Array.isArray(style.media) && style.media.length > 0 ? style.media : [];
  const coverMedia = style.coverImage
    ? [{ kind: style.coverImage.endsWith(".mp4") ? "video" : "image", src: style.coverImage }]
    : [];
  const fallbackMedia = (category.media || []).map((_, offset) => (
    category.media[(index + offset) % category.media.length]
  ));

  return cleanMediaList([...explicitMedia, ...coverMedia, ...fallbackMedia]);
}

export function styleSubcategoryKey(style) {
  if (style?.subcategory) return style.subcategory;

  const text = styleSearchText(style);
  if (style?.category === "ring") {
    if (text.includes("band") || text.includes("밴드") || text.includes("eternity") || text.includes("永恒")) {
      return "weddingBand";
    }
    if (text.includes("custom") || text.includes("freestyle") || text.includes("커스텀") || text.includes("定制")) {
      return "statementRing";
    }
  }
  if (style?.category === "earrings") {
    if (text.includes("drop") || text.includes("dangle")) return "drops";
    if (text.includes("hoop") || text.includes("huggie")) return "huggies";
  }
  if (style?.category === "bangle") {
    if (text.includes("bangle")) return "bangle";
    if (text.includes("chain")) return "chainBracelet";
  }
  if (style?.category === "necklace") {
    if (text.includes("station")) return "stationNecklace";
    if (text.includes("tennis")) return "tennisNecklace";
  }

  return defaultSubcategoryFor(style?.category);
}

export function designCategoryCards(styles, category, locale, pickI18n, options = {}) {
  const { fillSlots = true } = options;
  const realStyles = styles.filter((style) => style.category === category.key).slice(0, 5);
  const cards = realStyles.map((style, index) => {
    const mediaItems = styleMediaGallery(style, category, index);
    return {
      id: style.id,
      category: category.key,
      subcategory: styleSubcategoryKey(style),
      code: style.id,
      title: pickI18n(style.name, locale),
      media: mediaItems[0],
      mediaItems,
      lead: `${style.leadDays} days`,
      href: `/designs/${style.id}`,
      ctaHref: `/custom/new?style=${style.id}`,
      state: "published",
      mediaLabel: index === 0 ? "Hero sample" : "Sample media",
    };
  });

  while (fillSlots && cards.length < category.target) {
    const index = cards.length;
    const slotSubcategories = subcategoryKeysFor(category.key);
    const id = designSlotId(category.key, index);
    const name = sampleNameFor(category, index);
    const title = pickI18n(name, locale) || name.en;
    const mediaItems = cleanMediaList((category.media || []).map((_, offset) => (
      category.media[(index + offset) % category.media.length]
    )));
    cards.push({
      id,
      category: category.key,
      subcategory: slotSubcategories[index % Math.max(slotSubcategories.length, 1)] || defaultSubcategoryFor(category.key),
      code: "",
      title,
      media: mediaItems[0],
      mediaItems,
      lead: "Media slot ready",
      href: `/designs/${id}`,
      ctaHref: `/custom/new?category=${category.key}&design=${encodeURIComponent(title)}`,
      state: "slot",
      mediaLabel: "Photo / video slot",
    });
  }

  return cards.slice(0, 5);
}

export function getDesignSlotStyle(id) {
  const match = String(id || "").match(/^([a-z]+)-slot-(\d+)$/);
  if (!match) return null;

  const category = categoryMeta(match[1]);
  if (!category) return null;

  const index = Number(match[2]) - 1;
  const maxSlots = Math.max(category.target, category.names.length, category.media.length);
  if (!Number.isInteger(index) || index < 0 || index >= maxSlots) return null;

  const media = category.media[index % category.media.length];
  const slotSubcategories = subcategoryKeysFor(category.key);

  return {
    id: designSlotId(category.key, index),
    category: category.key,
    subcategory: slotSubcategories[index % Math.max(slotSubcategories.length, 1)] || defaultSubcategoryFor(category.key),
    coverImage: media.src,
    media: [media],
    mediaComplete: true,
    metalOptions: ["18kw", "18ky", "pt"],
    availableForSale: true,
    published: true,
    supplierEvidence: "Sample starting point",
    firstQuoteAt: "",
    name: sampleNameFor(category, index),
    ...SAMPLE_STYLE_DEFAULTS[category.key],
    ...SAMPLE_DETAIL_COPY,
  };
}
