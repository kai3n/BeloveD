// 다이아 그레이드 스케일 + 총 캐럿 범위 — 인테이크 range 슬라이더의 순수 로직 (React 의존 없음).
// 스케일은 "낮음 → 높음" 순서(슬라이더 왼쪽=낮음), 저장 형식은 [하한, 상한] 그레이드 문자열.
export const COLOR_SCALE = ["H", "G", "F", "E", "D"];
export const CLARITY_SCALE = ["SI1", "VS2", "VS1", "VVS2", "VVS1", "IF-FL"];

export const SOLITAIRE_COLOR_DEFAULT = ["F", "D"];
export const SOLITAIRE_CLARITY_DEFAULT = ["VS1", "IF-FL"];
export const MULTI_COLOR_DEFAULT = ["G", "E"];
export const MULTI_CLARITY_DEFAULT = ["VS2", "VVS1"];

// 솔리테어 센터 캐럿 슬라이더 경계 — 캐럿도 [하한, 상한] 허용 범위로 받는다
export const SOLITAIRE_CARAT = { min: 0.5, max: 4, step: 0.1, defaultRange: [1.5, 2] };

// 카테고리별 총 캐럿 슬라이더 범위 — 멀티스톤(테니스류 포함) 전용
export const TOTAL_CARAT_RANGES = {
  ring: { min: 0.5, max: 5, step: 0.25, default: 1.5, defaultRange: [1, 2] },
  bangle: { min: 1, max: 15, step: 0.5, default: 5, defaultRange: [4, 6] },
  necklace: { min: 2, max: 25, step: 0.5, default: 10, defaultRange: [8, 12] },
  earrings: { min: 0.5, max: 6, step: 0.25, default: 2, defaultRange: [1.5, 2.5] },
};

// IF/FL 단일 등급은 스케일에서 한 눈금(IF-FL)으로 묶는다
function normalizeGrade(scale, value) {
  const s = String(value || "").toUpperCase();
  if ((s === "IF" || s === "FL") && scale.includes("IF-FL")) return "IF-FL";
  return scale.includes(s) ? s : "";
}

// 단일값(레거시)·역전·스케일 밖 입력을 [하한, 상한]으로 정규화. 양끝 다 무효면 폴백.
export function clampGradeRange(scale, range, fallback) {
  const arr = Array.isArray(range) ? range : (range ? [range, range] : []);
  let lo = scale.indexOf(normalizeGrade(scale, arr[0]));
  let hi = scale.indexOf(normalizeGrade(scale, arr[1]));
  if (lo < 0 && hi < 0) return [...fallback];
  if (lo < 0) lo = hi;
  if (hi < 0) hi = lo;
  if (lo > hi) [lo, hi] = [hi, lo];
  return [scale[lo], scale[hi]];
}

// 표시 라벨 — 업계 관행대로 상급 먼저 (["F","D"] → "D–F")
export function formatGradeRange(range) {
  if (!Array.isArray(range) || !range[0]) return "";
  return range[0] === range[1] ? range[0] : `${range[1]}–${range[0]}`;
}

// 캐럿 range 정규화 — 단일값(레거시)은 [v,v], 역전 정렬, 경계 클램프, 둘 다 무효면 기본 range
export function clampCaratRange(bounds, range) {
  const arr = Array.isArray(range) ? range : (range != null && range !== "" ? [range, range] : []);
  let lo = Number(arr[0]);
  let hi = Number(arr[1]);
  if (!Number.isFinite(lo) && !Number.isFinite(hi)) return [...bounds.defaultRange];
  if (!Number.isFinite(lo)) lo = hi;
  if (!Number.isFinite(hi)) hi = lo;
  if (lo > hi) [lo, hi] = [hi, lo];
  const clamp = (n) => Math.min(bounds.max, Math.max(bounds.min, n));
  return [clamp(lo), clamp(hi)];
}

// 캐럿 range 표시 라벨 — "1.50–2.00ct", 하한=상한이면 "1.50ct"
export function formatCaratRange(range) {
  if (!Array.isArray(range) || !Number.isFinite(Number(range[0]))) return "";
  const lo = Number(range[0]);
  const hi = Number(range[1] ?? range[0]);
  return lo === hi ? `${lo.toFixed(2)}ct` : `${lo.toFixed(2)}–${hi.toFixed(2)}ct`;
}

// 견적·프리뷰용 중간값 — range의 대표 단일 수치
export function caratRangeMid(range) {
  const lo = Number(range?.[0]);
  const hi = Number(range?.[1] ?? range?.[0]);
  if (!Number.isFinite(lo)) return null;
  return (lo + (Number.isFinite(hi) ? hi : lo)) / 2;
}

// 총 캐럿을 카테고리 경계 range로 정규화 (단일 레거시 값 포함)
export function clampTotalCaratRange(category, range) {
  return clampCaratRange(TOTAL_CARAT_RANGES[category] || TOTAL_CARAT_RANGES.ring, range);
}
