// 칩 어휘 사전 — 무언어(zero-language) 수정 요청의 단어장.
// 자유 텍스트 입력이 없는 것이 보안 설계의 핵심: 오역·연락처 교환 경로가 구조적으로 없다.
// 이 파일은 내부 모듈을 import하지 않는다 (store.js → chips.js 단방향).

export const CHIP_PARTS = ["band", "prong", "stone", "halo", "gallery", "chain", "clasp", "surface"];

// parts: null = 모든 부위 적용 가능. valueType: "mm" | "none".
export function defaultChipCatalog() {
  return [
    { key: "thinner", parts: ["band", "prong", "chain"], valueType: "mm", active: true,
      labels: { en: "Thinner", zh: "更细", ko: "더 얇게", es: "Más fino" } },
    { key: "thicker", parts: ["band", "prong", "chain"], valueType: "mm", active: true,
      labels: { en: "Thicker", zh: "更粗", ko: "더 두껍게", es: "Más grueso" } },
    { key: "lower", parts: ["stone", "halo", "gallery"], valueType: "mm", active: true,
      labels: { en: "Set lower", zh: "降低镶座", ko: "세팅 낮게", es: "Engaste más bajo" } },
    { key: "higher", parts: ["stone", "halo", "gallery"], valueType: "mm", active: true,
      labels: { en: "Set higher", zh: "抬高镶座", ko: "세팅 높게", es: "Engaste más alto" } },
    { key: "smaller", parts: null, valueType: "mm", active: true,
      labels: { en: "Smaller", zh: "更小", ko: "더 작게", es: "Más pequeño" } },
    { key: "larger", parts: null, valueType: "mm", active: true,
      labels: { en: "Larger", zh: "更大", ko: "더 크게", es: "Más grande" } },
    { key: "prong4", parts: ["prong"], valueType: "none", active: true,
      labels: { en: "4 prongs", zh: "4爪", ko: "4프롱", es: "4 garras" } },
    { key: "prong6", parts: ["prong"], valueType: "none", active: true,
      labels: { en: "6 prongs", zh: "6爪", ko: "6프롱", es: "6 garras" } },
    { key: "polishHigh", parts: ["band", "surface"], valueType: "none", active: true,
      labels: { en: "High polish", zh: "高抛光", ko: "유광 마감", es: "Pulido brillante" } },
    { key: "polishMatte", parts: ["band", "surface"], valueType: "none", active: true,
      labels: { en: "Matte finish", zh: "哑光", ko: "무광 마감", es: "Acabado mate" } },
    { key: "likeReference", parts: null, valueType: "none", active: true,
      labels: { en: "Like my reference", zh: "按参考图", ko: "레퍼런스처럼", es: "Como mi referencia" } },
  ];
}

export function chipFor(catalog, key) {
  return catalog.find((c) => c.key === key && c.active !== false) || null;
}

export function chipAppliesTo(chip, part) {
  return !chip.parts || chip.parts.includes(part);
}

// annotation: { pinId, x, y, part, chipKey, value? } — x/y는 이미지 기준 % (0–100, 반응형 대응)
export function validateAnnotation(a, catalog) {
  if (!a || typeof a.x !== "number" || typeof a.y !== "number") return false;
  if (a.x < 0 || a.x > 100 || a.y < 0 || a.y > 100) return false;
  if (!CHIP_PARTS.includes(a.part)) return false;
  const chip = chipFor(catalog, a.chipKey);
  if (!chip || !chipAppliesTo(chip, a.part)) return false;
  if (chip.valueType === "mm") return typeof a.value === "number" && a.value > 0;
  return a.value == null;
}

// 같은 주석 데이터를 구매자/벤더가 각자의 언어로 읽는다 — 번역이 아니라 key 렌더링
export function formatAnnotation(a, catalog, locale, partLabels = {}) {
  const chip = catalog.find((c) => c.key === a.chipKey);
  const label = chip ? (chip.labels[locale] ?? chip.labels.en) : a.chipKey;
  const part = partLabels[a.part] || a.part;
  return chip?.valueType === "mm" && a.value != null ? `${part} · ${label} → ${a.value}mm` : `${part} · ${label}`;
}
