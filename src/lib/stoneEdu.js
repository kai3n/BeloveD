// 센터스톤 교육 패널 — 순수 데이터/계산. 표시(SVG)는 components/StoneEducation.jsx 담당.
export const EDU_FIELDS = ["shape", "carat", "color", "clarity", "growth", "lab", "fluorescence", "lwRatio"];

// 교육 스케일은 폼 선택지(D–G)보다 넓게 보여준다 — 등급이 어디쯤인지 감각을 주기 위함
export const COLOR_SCALE = ["D", "E", "F", "G", "H", "I", "J"];
export const COLOR_TINTS = {
  D: "#f8fafc", E: "#f7f7f2", F: "#f6f4e9", G: "#f4f0de", H: "#f2ebd1", I: "#f0e6c3", J: "#eee0b5",
};

export const CLARITY_SCALE = ["IF", "VVS1", "VVS2", "VS1", "VS2"];
export const CLARITY_DOTS = { IF: 0, VVS1: 1, VVS2: 2, VS1: 3, VS2: 5 };

export const FLUOR_LEVELS = ["none", "faint", "medium"]; // 인테이크 select value와 동일

export const CARAT_REFS = [0.5, 1, 1.5, 2, 3];
export const RATIO_EXAMPLES = [1.0, 1.35, 1.5];

// 라운드 브릴리언트 근사 정면 직경 — 1ct ≈ 6.45mm, 직경 ∝ ∛중량
export function caratDiameterMm(carat) {
  const c = Number(carat);
  if (!Number.isFinite(c) || c <= 0) return null;
  return 6.45 * Math.cbrt(c);
}

export function nearestIndex(list, value) {
  const v = Number(value);
  if (value === "" || value == null || !Number.isFinite(v)) return -1;
  let best = 0;
  for (let i = 1; i < list.length; i++) {
    if (Math.abs(list[i] - v) < Math.abs(list[best] - v)) best = i;
  }
  return best;
}
