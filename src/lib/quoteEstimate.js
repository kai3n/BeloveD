// 인테이크 리뷰용 예상 견적 — 확정 견적 이전의 '예비 추정'.
// 워크숍 가격 공식(quoteCompute)을 그대로 쓰되, 스톤이 확정 전이라 ±범위로 제시.
// 경쟁사(Blue Nile / Brilliant Earth)는 BeloveD 추정에 고정 배수를 적용해 비교 표시.
import { benchmarkFor, findCoupon, getSettings, listStyleSpecs } from "./store.js";
import { quoteCompute } from "./ops.js";
import { applyCoupon } from "./coupons.js";
import { SOLITAIRE_CARAT, caratRangeMid, clampCaratRange, clampTotalCaratRange } from "./gradeScale.js";

// 컬러/클래리티에 따른 소폭 보정 — 등급이 높을수록 비싸진다(표시용 추정).
const COLOR_FACTOR = { D: 1.12, E: 1.06, F: 1.0, G: 0.95, H: 0.9 };
const CLARITY_FACTOR = { "IF-FL": 1.12, IF: 1.12, VVS1: 1.08, VVS2: 1.05, VS1: 1.0, VS2: 0.96, SI1: 0.9 };

// range 양끝 factor 평균 — 레거시 단일값(form.color)은 그대로 조회
function rangeFactor(factors, range, legacy) {
  if (Array.isArray(range) && range.length) {
    return ((factors[range[0]] ?? 1.0) + (factors[range[1]] ?? 1.0)) / 2;
  }
  return factors[legacy] ?? 1.0;
}
// 스펙이 없을 때의 카테고리별 기본 세팅 중량(g)/공임(USD)
const DEFAULT_WEIGHT_G = { ring: 4.2, necklace: 3.0, bangle: 9.0, earrings: 3.4 };
const DEFAULT_LABOR_USD = { ring: 320, necklace: 260, bangle: 520, earrings: 300 };

// 경쟁사 배수 — 동일 사양 기준 일반적인 리테일 격차(표시용 가정).
const COMPETITORS = [
  { name: "Blue Nile", lo: 1.95, hi: 2.05 },
  { name: "Brilliant Earth", lo: 1.62, hi: 1.72 },
];

const round10 = (n) => Math.round(n / 10) * 10;

export function estimateQuoteRange(form) {
  const s = getSettings() || {};
  const metalRefUsdPerG = s.metalRefUsdPerG?.[form.metal] ?? 85;
  const multiplier = s.opsMultiplier ?? 1.8;
  const lossRatePct = s.defaultLossRatePct ?? 8;
  const depositRate = s.opsDepositRate ?? 0.3; // 공개 정책·서버 기본과 동일 (30%)

  // 세팅 중량/공임: 선택 스타일의 승인 스펙 우선, 없으면 카테고리 기본값
  const spec = form.styleId
    ? (listStyleSpecs(form.styleId) || []).find((sp) => sp.metal === form.metal)
    : null;
  const estWeightG = spec?.estWeightG ?? DEFAULT_WEIGHT_G[form.category] ?? 4.0;
  const nonMetalUsd = (spec ? (spec.laborUsd || 0) + (spec.materialsUsd || 0) : 0)
    || DEFAULT_LABOR_USD[form.category] || 300;

  // 스톤 단가
  const solitaire = form.productLine === "solitaire";
  let benchmarkUsdPerCt;
  let carat;
  if (solitaire) {
    // 캐럿 range의 중간값으로 추정 — ±밴드가 범위의 불확실성을 표현한다
    carat = caratRangeMid(clampCaratRange(SOLITAIRE_CARAT, form.stonePrefs?.caratRange ?? form.stonePrefs?.carat)) || 1.0;
    const bench = benchmarkFor(form.stonePrefs?.shape || "round", carat);
    const unit = bench?.unitUsdPerCt ?? 400;
    benchmarkUsdPerCt = unit
      * rangeFactor(COLOR_FACTOR, form.stonePrefs?.colorRange, form.stonePrefs?.color)
      * rangeFactor(CLARITY_FACTOR, form.stonePrefs?.clarityRange, form.stonePrefs?.clarity);
  } else {
    // 멀티스톤: 총 캐럿 range 중간값 × 멜리 단가 — 퀄리티 range는 상담에서 확정(견적 미반영)
    carat = caratRangeMid(clampTotalCaratRange(form.category, form.multiSpec?.totalCaratRange ?? form.multiSpec?.totalCarat));
    benchmarkUsdPerCt = s.meleeUsdPerCt ?? 150;
  }

  const { totalUsd, diamondAmountUsd } = quoteCompute({
    carat, benchmarkUsdPerCt, multiplier,
    estWeightG, metalRefUsdPerG, lossRatePct, nonMetalUsd, depositRate,
  });

  // 쿠폰 — 스프레드 전 총액에 적용해 절감액을 단일 수치로 보여준다.
  // 경쟁사 범위는 미할인 기준 유지(경쟁사에 내 쿠폰은 없다) — 절감폭이 자연히 커진다.
  const coupon = findCoupon(form.couponCode);
  const applied = applyCoupon({ totalUsd, diamondAmountUsd, multiplier }, coupon);

  const low = round10(applied.totalUsd * 0.92);
  const high = round10(applied.totalUsd * 1.1);
  const baseLow = round10(totalUsd * 0.92);
  const baseHigh = round10(totalUsd * 1.1);

  const competitors = COMPETITORS.map((c) => ({
    name: c.name,
    low: round10(baseLow * c.lo),
    high: round10(baseHigh * c.hi),
  }));
  const top = competitors.reduce((a, b) => (b.high > a.high ? b : a));

  return {
    solitaire,
    beloved: { low, high },
    competitors,
    topName: top.name,
    savingsTop: top.high - low, // "Up to $X less than <top>"
    coupon: coupon ? { code: coupon.code, labelKey: coupon.labelKey, savedUsd: round10(applied.discountUsd) } : null,
  };
}

// 홈 가격 비교 보드용 루스 스톤 시세 — 세팅·메탈 없이 스톤 단독 고객가.
// 벤치마크·배수는 어드민 설정을 그대로 읽으므로 보드가 견적 엔진과 항상 정합.
export function estimateLooseStoneCompare({ shape = "round", carat = 1.0, color = "F", clarity = "VS1" } = {}) {
  const s = getSettings() || {};
  const multiplier = s.opsMultiplier ?? 1.8;
  const unit = (benchmarkFor(shape, carat)?.unitUsdPerCt ?? 400)
    * (COLOR_FACTOR[color] ?? 1.0)
    * (CLARITY_FACTOR[clarity] ?? 1.0);
  const stoneUsd = unit * carat * multiplier;
  const low = round10(stoneUsd * 0.92);
  const high = round10(stoneUsd * 1.1);
  const competitors = COMPETITORS.map((c) => ({
    name: c.name,
    low: round10(low * c.lo),
    high: round10(high * c.hi),
  }));
  const top = competitors.reduce((a, b) => (b.high > a.high ? b : a));
  return { beloved: { low, high }, competitors, topName: top.name, savingsTop: top.high - low };
}
