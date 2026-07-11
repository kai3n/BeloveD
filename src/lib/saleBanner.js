// 세일 배너 문구 결정 — 현재 로케일 → EN 폴백 → 없으면 null(배너 숨김). 순수 로직.
export function resolveSaleBanner(saleBanner, locale) {
  if (!saleBanner?.enabled) return null;
  const text = (saleBanner.copy?.[locale] || saleBanner.copy?.en || "").trim();
  if (!text) return null;
  return { text, code: (saleBanner.code || "").trim() };
}
