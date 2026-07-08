// 다이아 그레이드 스케일 + 총 캐럿 범위 — 인테이크 range 슬라이더의 순수 로직 (React 의존 없음).
// 스케일은 "낮음 → 높음" 순서(슬라이더 왼쪽=낮음), 저장 형식은 [하한, 상한] 그레이드 문자열.
export const COLOR_SCALE = ["H", "G", "F", "E", "D"];
export const CLARITY_SCALE = ["SI1", "VS2", "VS1", "VVS2", "VVS1", "IF-FL"];

export const SOLITAIRE_COLOR_DEFAULT = ["F", "D"];
export const SOLITAIRE_CLARITY_DEFAULT = ["VS1", "IF-FL"];
export const MULTI_COLOR_DEFAULT = ["G", "E"];
export const MULTI_CLARITY_DEFAULT = ["VS2", "VVS1"];

// 카테고리별 총 캐럿 슬라이더 범위 — 멀티스톤(테니스류 포함) 전용
export const TOTAL_CARAT_RANGES = {
  ring: { min: 0.5, max: 5, step: 0.25, default: 1.5 },
  bangle: { min: 1, max: 15, step: 0.5, default: 5 },
  necklace: { min: 2, max: 25, step: 0.5, default: 10 },
  earrings: { min: 0.5, max: 6, step: 0.25, default: 2 },
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

// 총 캐럿을 카테고리 범위로 — 범위 밖(구 드래프트·카테고리 변경)은 기본값으로 리셋
export function clampTotalCarat(category, value) {
  const r = TOTAL_CARAT_RANGES[category] || TOTAL_CARAT_RANGES.ring;
  const n = Number(value);
  return Number.isFinite(n) && n >= r.min && n <= r.max ? n : r.default;
}
