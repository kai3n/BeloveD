import { describe, expect, it } from "vitest";
import {
  metalQuote, unitWholesale, quarterKey, computeTier, canClaimTransition, salvageCredit,
} from "../dealer.js";

const item = { stoneWholesaleT1: 2250, stoneWholesaleT2: 2500, metalGrams: 8, laborUsd: 60 };
const settings = { goldSpotPerGram: 85, goldPurity: 0.75, tierThresholdUsd: 20000 };

describe("dealer pricing", () => {
  it("메탈 견적 = 중량 × 스팟 × 순도 + 공임", () => {
    expect(metalQuote(item, 85, 0.75)).toBe(8 * 85 * 0.75 + 60); // 570
  });
  it("도매 단가 = 티어 스톤가 + 메탈 견적", () => {
    expect(unitWholesale(item, 1, settings)).toBe(2250 + 570);
    expect(unitWholesale(item, 2, settings)).toBe(2500 + 570);
  });
  it("샐비지 크레딧 = 회수 골드 g × 스팟 × 75%", () => {
    expect(salvageCredit(8, 85)).toBe(Math.round(8 * 85 * 0.75));
  });
});

describe("tier 산정", () => {
  const mkOrder = (usd, iso, status = "DELIVERED") => ({ totalUsd: usd, createdAt: iso, status });
  const now = new Date("2026-06-12T00:00:00Z");

  it("분기 키", () => {
    expect(quarterKey(new Date("2026-06-12"))).toBe("2026-Q2");
    expect(quarterKey(new Date("2026-01-02"))).toBe("2026-Q1");
  });

  it("이번 분기 구매량이 임계값 이상이면 T1", () => {
    const orders = [mkOrder(15000, "2026-05-01T00:00:00Z"), mkOrder(6000, "2026-06-01T00:00:00Z")];
    const r = computeTier(orders, { tier: 2 }, settings, now);
    expect(r.tier).toBe(1);
    expect(r.quarterVolume).toBe(21000);
  });

  it("CANCELLED 주문은 볼륨에서 제외", () => {
    const orders = [mkOrder(25000, "2026-05-01T00:00:00Z", "CANCELLED")];
    expect(computeTier(orders, { tier: 2 }, settings, now).tier).toBe(2);
  });

  it("T1 딜러가 2분기 연속 미달이면 T2 강등, 1분기 미달은 유지", () => {
    const oneBelow = [mkOrder(25000, "2025-12-05T00:00:00Z")]; // Q4 충족, Q1 미달, Q2(현재) 진행중
    expect(computeTier(oneBelow, { tier: 1 }, settings, now).tier).toBe(1);
    const twoBelow = [mkOrder(25000, "2025-09-05T00:00:00Z")]; // Q4·Q1 연속 미달
    expect(computeTier(twoBelow, { tier: 1 }, settings, now).tier).toBe(2);
  });

  it("수동 오버라이드가 최우선", () => {
    expect(computeTier([], { tier: 2, tierOverride: 1 }, settings, now).tier).toBe(1);
  });
});

describe("claim 상태머신", () => {
  it("허용 전이", () => {
    expect(canClaimTransition("SUBMITTED", "APPROVED")).toBe(true);
    expect(canClaimTransition("SUBMITTED", "DENIED")).toBe(true);
    expect(canClaimTransition("APPROVED", "AWAITING_RETURN")).toBe(true);
    expect(canClaimTransition("AWAITING_RETURN", "RETURN_RECEIVED")).toBe(true);
    expect(canClaimTransition("RETURN_RECEIVED", "REPLACED")).toBe(true);
  });
  it("거부 전이", () => {
    expect(canClaimTransition("DENIED", "APPROVED")).toBe(false);
    expect(canClaimTransition("SUBMITTED", "REPLACED")).toBe(false);
    expect(canClaimTransition("REPLACED", "SUBMITTED")).toBe(false);
  });
});
