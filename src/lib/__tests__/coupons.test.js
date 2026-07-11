import { beforeEach, describe, expect, it } from "vitest";
import { applyCoupon, isCouponActive, normalizeCouponCode } from "../coupons.js";
import { addCoupon, createIntake, createQuote, findCoupon, listCoupons, removeCoupon, resetDB } from "../store.js";
import { buildIntakePayload } from "../intakePayload.js";
import { estimateQuoteRange } from "../quoteEstimate.js";

beforeEach(() => resetDB());

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

describe("normalizeCouponCode / findCoupon (settings.coupons)", () => {
  it("trim·대문자·내부 공백 제거 후 시드 카탈로그 조회 (대소문자 무시)", () => {
    expect(normalizeCouponCode("  bd-atcost ")).toBe("BD-ATCOST");
    expect(findCoupon("welcome5")?.code).toBe("WELCOME5");
    expect(findCoupon(" bd - private ")?.code).toBe("BD-PRIVATE");
    expect(findCoupon("NOPE")).toBeNull();
    expect(findCoupon("")).toBeNull();
  });

  it("만료된 쿠폰은 조회되지 않는다 (당일까지는 유효)", () => {
    const today = new Date().toISOString().slice(0, 10);
    addCoupon({ code: "past10", value: 10, expiresAt: "2020-01-01" });
    addCoupon({ code: "today10", value: 10, expiresAt: today });
    addCoupon({ code: "open10", value: 10 });
    expect(findCoupon("PAST10")).toBeNull();
    expect(findCoupon("TODAY10")?.code).toBe("TODAY10");
    expect(findCoupon("OPEN10")?.code).toBe("OPEN10");
    expect(isCouponActive({ expiresAt: "2020-01-01" }, today)).toBe(false);
    expect(isCouponActive({ expiresAt: null }, today)).toBe(true);
  });
});

describe("addCoupon / removeCoupon", () => {
  it("등록: percent 쿠폰 정규화 저장, 중복·범위 밖 값은 거절", () => {
    const c = addCoupon({ code: " summer 20 ", value: 20, expiresAt: "2099-12-31" });
    expect(c).toMatchObject({ code: "SUMMER20", kind: "percent", value: 20, expiresAt: "2099-12-31" });
    expect(listCoupons().some((x) => x.code === "SUMMER20")).toBe(true);
    expect(addCoupon({ code: "SUMMER20", value: 10 })).toBeNull(); // 중복
    expect(addCoupon({ code: "welcome5", value: 10 })).toBeNull(); // 시드와 중복
    expect(addCoupon({ code: "BAD", value: 0 })).toBeNull();
    expect(addCoupon({ code: "BAD", value: 100 })).toBeNull();
    expect(addCoupon({ code: "", value: 10 })).toBeNull();
  });

  it("삭제: 코드로 제거되고 findCoupon에서 사라진다", () => {
    addCoupon({ code: "GONE10", value: 10 });
    expect(findCoupon("GONE10")).not.toBeNull();
    expect(removeCoupon("gone10")).toBe(true);
    expect(findCoupon("GONE10")).toBeNull();
    expect(removeCoupon("GONE10")).toBe(false);
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
  it("쿠폰이 예상 견적을 낮춘다 — BD-ATCOST(마진0)가 WELCOME5보다 크게, 어드민 쿠폰도 동작", () => {
    const base = estimateQuoteRange(ringForm());
    const welcome = estimateQuoteRange(ringForm({ couponCode: "welcome5" }));
    const atcost = estimateQuoteRange(ringForm({ couponCode: "BD-ATCOST" }));
    expect(base.coupon).toBeNull();
    expect(welcome.beloved.low).toBeLessThan(base.beloved.low);
    expect(atcost.beloved.low).toBeLessThan(welcome.beloved.low);
    expect(welcome.coupon).toMatchObject({ code: "WELCOME5", labelKey: "welcome" });
    expect(welcome.coupon.savedUsd).toBeGreaterThan(0);
    // 어드민 등록 이벤트 쿠폰(라벨키 없음)도 견적에 반영
    addCoupon({ code: "EVENT20", value: 20 });
    const event = estimateQuoteRange(ringForm({ couponCode: "event20" }));
    expect(event.beloved.low).toBeLessThan(welcome.beloved.low);
    expect(event.coupon.code).toBe("EVENT20");
  });

  it("인테이크 쿠폰은 로컬 견적(createQuote)에 자동 반영된다", () => {
    const payload = buildIntakePayload(ringForm({ name: "C", contact: "c@x.com", couponCode: "welcome5" }), [], null);
    const { order } = createIntake(payload, null);
    // 다이아 후보 없음 → 다이아 0, 베이스 = 메탈 400 + 공임 600 = 1000 → 5% 할인
    const q = createQuote(order.id, { estWeightG: 4, metalRefUsdPerG: 100, lossRatePct: 0, nonMetalUsd: 600 });
    expect(q.totalUsd).toBe(950);
    expect(q.coupon).toEqual({ code: "WELCOME5", discountUsd: 50 });
    expect(q.depositUsd).toBe(285); // opsDepositRate 0.3 — 공개 정책 30%와 동일
    expect(q.balanceUsd).toBe(665);
  });
});

describe("LAUNCH25 런칭 쿠폰", () => {
  it("시드에 25% percent로 존재한다", () => {
    const coupon = findCoupon("launch25");
    expect(coupon).toMatchObject({ code: "LAUNCH25", kind: "percent", value: 25 });
  });
  it("applyCoupon이 총액 25%를 깎는다", () => {
    const out = applyCoupon({ totalUsd: 4000, diamondAmountUsd: 2000, multiplier: 1.8 }, { kind: "percent", value: 25 });
    expect(out.totalUsd).toBe(3000);
    expect(out.discountUsd).toBe(1000);
  });
});
