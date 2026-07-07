import { beforeEach, describe, expect, it } from "vitest";
import { applyCoupon, findCoupon, normalizeCouponCode } from "../coupons.js";
import { createIntake, createQuote, resetDB } from "../store.js";
import { buildIntakePayload } from "../intakePayload.js";
import { estimateQuoteRange } from "../quoteEstimate.js";

function ringForm(overrides = {}) {
  return {
    name: "", contact: "", productLine: "solitaire", category: "ring", subcategory: "engagementRing",
    styleId: "", metal: "18kw", conditional: { ringSize: "6" },
    stonePrefs: { shape: "round", carat: "1.5", color: "E", clarity: "VS1", growth: "CVD", lab: "IGI India", colorTreatment: "disclosed", fluorescence: "none", lwRatio: "" },
    multiSpec: { meleeSpec: "", overallDims: "", arrangement: "", standard: "" },
    requiredDate: "", termsAccepted: true,
    ...overrides,
  };
}

describe("normalizeCouponCode / findCoupon", () => {
  it("trim·대문자·내부 공백 제거 후 카탈로그 조회 (대소문자 무시)", () => {
    expect(normalizeCouponCode("  bd-atcost ")).toBe("BD-ATCOST");
    expect(findCoupon("welcome5")?.code).toBe("WELCOME5");
    expect(findCoupon(" bd - private ")?.code).toBe("BD-PRIVATE");
    expect(findCoupon("NOPE")).toBeNull();
    expect(findCoupon("")).toBeNull();
  });
});

describe("applyCoupon", () => {
  const totals = { totalUsd: 1900, diamondAmountUsd: 900, multiplier: 1.8 };
  it("margin0: 다이아를 원가(멀티플라이어 1.0)로 환원", () => {
    const r = applyCoupon(totals, findCoupon("BD-ATCOST"));
    expect(r.totalUsd).toBe(1500); // 1900 − 900 + round(900/1.8)
    expect(r.discountUsd).toBe(400);
  });
  it("percent: 총액 % 할인", () => {
    expect(applyCoupon(totals, findCoupon("WELCOME5")).totalUsd).toBe(1805);
    expect(applyCoupon(totals, findCoupon("BD-PRIVATE")).totalUsd).toBe(1615);
  });
  it("쿠폰 없음: 무변화", () => {
    expect(applyCoupon(totals, null)).toEqual({ totalUsd: 1900, discountUsd: 0 });
  });
});

describe("쿠폰 → 예상 견적/로컬 견적 반영", () => {
  beforeEach(() => resetDB());

  it("쿠폰이 예상 견적을 낮춘다 — BD-ATCOST(마진0)가 WELCOME5보다 크게", () => {
    const base = estimateQuoteRange(ringForm());
    const welcome = estimateQuoteRange(ringForm({ couponCode: "welcome5" }));
    const atcost = estimateQuoteRange(ringForm({ couponCode: "BD-ATCOST" }));
    expect(base.coupon).toBeNull();
    expect(welcome.beloved.low).toBeLessThan(base.beloved.low);
    expect(atcost.beloved.low).toBeLessThan(welcome.beloved.low);
    expect(welcome.coupon).toMatchObject({ code: "WELCOME5", labelKey: "welcome" });
    expect(welcome.coupon.savedUsd).toBeGreaterThan(0);
  });

  it("인테이크 쿠폰은 로컬 견적(createQuote)에 자동 반영된다", () => {
    const payload = buildIntakePayload(ringForm({ name: "C", contact: "c@x.com", couponCode: "welcome5" }), [], null);
    const { order } = createIntake(payload, null);
    // 다이아 후보 없음 → 다이아 0, 베이스 = 메탈 400 + 공임 600 = 1000 → 5% 할인
    const q = createQuote(order.id, { estWeightG: 4, metalRefUsdPerG: 100, lossRatePct: 0, nonMetalUsd: 600 });
    expect(q.totalUsd).toBe(950);
    expect(q.coupon).toEqual({ code: "WELCOME5", discountUsd: 50 });
    expect(q.depositUsd).toBe(475); // opsDepositRate 0.5
    expect(q.balanceUsd).toBe(475);
  });
});
