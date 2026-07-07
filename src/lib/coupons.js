// 쿠폰 순수 헬퍼 + 기본 시드 — 카탈로그 자체는 settings.coupons(store)에 산다.
// 코드가 번들/공개 설정에 노출되므로 '비밀'이 아니라 '약속'이다:
// 최종 적용은 오퍼레이터가 확정 제안(견적)에서 검증한다 (RFQ 흐름, 남용 시 거절).
// margin0 = 다이아 멀티플라이어를 1.0으로 환원(마진 0%, 원가). percent = 총액 % 할인.
export const BASE_COUPONS = [
  { code: "BD-ATCOST", kind: "margin0", labelKey: "staff", expiresAt: null },
  { code: "BD-PRIVATE", kind: "percent", value: 15, labelKey: "private", expiresAt: null },
  { code: "WELCOME5", kind: "percent", value: 5, labelKey: "welcome", expiresAt: null },
];

export function normalizeCouponCode(raw) {
  return String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
}

// 만료 판정 — expiresAt 당일까지 유효, 없으면 무기한
export function isCouponActive(coupon, today) {
  return !coupon?.expiresAt || coupon.expiresAt >= today;
}

export function applyCoupon({ totalUsd, diamondAmountUsd, multiplier }, coupon) {
  let discounted = totalUsd;
  if (coupon?.kind === "margin0" && multiplier > 0) {
    discounted = totalUsd - diamondAmountUsd + Math.round(diamondAmountUsd / multiplier);
  } else if (coupon?.kind === "percent") {
    discounted = Math.round(totalUsd * (1 - coupon.value / 100));
  }
  return { totalUsd: discounted, discountUsd: totalUsd - discounted };
}
