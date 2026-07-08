// 실서버 제안서 컴포저용 자동 견적 — 워크숍 가격 엔진(벤치마크 매트릭스·메탈 시세·스타일 스펙)을
// 그대로 재사용해 Total/Deposit 제안값을 만든다. 발송 전 어드민이 확인·수정하는 '추정치'다.
import { benchmarkFor, getSettings, listStyleSpecs } from "./store.js";
import { quoteCompute } from "./ops.js";

// 메탈 코드 → 라벨 (인테이크 프리필·폼 셀렉트 옵션의 단일 소스)
export const METAL_LABELS = {
  "18kw": "18K White Gold", "18ky": "18K Yellow Gold", "18kr": "18K Rose Gold",
  "14kw": "14K White Gold", "14ky": "14K Yellow Gold", "14kr": "14K Rose Gold",
  pt950: "Platinum 950",
};
const METAL_KEY_BY_LABEL = Object.fromEntries(Object.entries(METAL_LABELS).map(([k, v]) => [v, k]));

// 벤치마크는 CVD·D-F·VVS-VS·IGI 기준(store.js) — 그 외 조합은 소폭 보정(표시용 추정)
const COLOR_FACTOR = { D: 1.12, E: 1.06, F: 1.0, G: 0.95, H: 0.9, I: 0.85 };
const CLARITY_FACTOR = { IF: 1.12, VVS1: 1.08, VVS2: 1.05, VS1: 1.0, VS2: 0.96, SI1: 0.9, SI2: 0.85 };
const GROWTH_FACTOR = { CVD: 1.0, HPHT: 1.04 };
const LAB_FACTOR = { IGI: 1.0, GIA: 1.08 };
// 스타일 스펙이 없을 때의 카테고리별 기본 중량(g)/공임(USD) — quoteEstimate.js와 동일 가정
const DEFAULT_WEIGHT_G = { ring: 4.2, necklace: 3.0, bangle: 9.0, earrings: 3.4 };
const DEFAULT_LABOR_USD = { ring: 320, necklace: 260, bangle: 520, earrings: 300 };
const DEPOSIT_RATE = 0.3; // 서버 기본(Deposit 공백 = 30%)과 동일하게

const round10 = (n) => Math.round(n / 10) * 10;

// 폼에는 라벨("18K White Gold")·시세 키("18kw")·인테이크 원값("pt")이 섞여 들어올 수 있다
function metalKeyFor(metalSpec) {
  const key = METAL_KEY_BY_LABEL[metalSpec] || String(metalSpec || "").toLowerCase();
  return key === "pt950" ? "pt" : key;
}

export function estimateProposalQuote({
  metalSpec, estWeightG, shape, caratMin, caratMax, color, clarity, growth, lab, styleId, category,
}) {
  const lo = Number(caratMin) || 0;
  const hi = Number(caratMax) || 0;
  const carat = lo && hi ? (lo + hi) / 2 : lo || hi;
  if (carat <= 0) return null; // 다이아가 총액의 대부분 — 캐럿 없인 추정 무의미

  const s = getSettings() || {};
  const multiplier = s.opsMultiplier ?? 1.8;
  const lossRatePct = s.defaultLossRatePct ?? 8;

  // 다이아 단가: shape×캐럿 티어 벤치마크(없는 셰이프는 round 폴백) × 등급 보정
  const bench = benchmarkFor(shape, carat) || benchmarkFor("round", carat);
  const benchmarkUsdPerCt = (bench?.unitUsdPerCt ?? 400)
    * (COLOR_FACTOR[color] ?? 1.0)
    * (CLARITY_FACTOR[clarity] ?? 1.0)
    * (GROWTH_FACTOR[growth] ?? 1.0)
    * (LAB_FACTOR[lab] ?? 1.0);

  // 메탈 중량: 직접 입력 → 스타일 스펙(메탈 일치) → 카테고리 기본값
  const metalKey = metalKeyFor(metalSpec);
  const spec = styleId
    ? (listStyleSpecs(styleId) || []).find((sp) => sp.metal === metalKey)
    : null;
  const weightG = Number(estWeightG) || spec?.estWeightG || DEFAULT_WEIGHT_G[category] || 4.0;
  const metalRefUsdPerG = s.metalRefUsdPerG?.[metalKey]
    ?? (metalKey.startsWith("14k") ? s.metalRefUsdPerG?.["14ky"] : undefined)
    ?? 85;

  // 공임+부자재: 스타일 스펙 우선, 없으면 카테고리 기본값
  const laborUsd = Math.round((spec ? (spec.laborUsd || 0) + (spec.materialsUsd || 0) : 0)
    || DEFAULT_LABOR_USD[category] || 300);

  const q = quoteCompute({
    carat, benchmarkUsdPerCt, multiplier,
    estWeightG: weightG, metalRefUsdPerG, lossRatePct, nonMetalUsd: laborUsd, depositRate: DEPOSIT_RATE,
  });

  const totalUsd = round10(q.totalUsd);
  return {
    totalUsd,
    depositUsd: round10(totalUsd * DEPOSIT_RATE),
    diamondUsd: q.diamondAmountUsd,
    metalUsd: q.metalAmountUsd,
    laborUsd,
  };
}
