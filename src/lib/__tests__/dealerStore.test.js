import { beforeEach, describe, expect, it } from "vitest";
import {
  resetDB, submitApplication, approveApplication, listDealers, getDealerProfile,
  createWholesaleOrder, transitionWholesale, registerWarranty, submitClaim,
  adjudicateClaim, receiveClaimReturn, markClaimReplaced, listSalvage, dealerTierInfo, updateDealerProfile,
} from "../store.js";

beforeEach(() => resetDB());

describe("dealer store", () => {
  it("지원 → 승인 → T2 딜러 계정 생성", () => {
    const app = submitApplication({ bizName: "Test Gems", city: "Austin, TX", contactName: "Kim", email: "test@gems.example", permitNo: "TX-1", resaleCertNo: "RC-1", expectedQuarterlyUsd: 9000 });
    const user = approveApplication(app.id);
    expect(user.role).toBe("dealer");
    expect(getDealerProfile(user.id).tier).toBe(2);
    expect(listDealers().length).toBe(3);
  });

  it("resale cert 없으면 도매 주문 차단", () => {
    const app = submitApplication({ bizName: "NoCert", city: "X", contactName: "Y", email: "nocert@x.example", permitNo: "P", resaleCertNo: "", expectedQuarterlyUsd: 0 });
    const user = approveApplication(app.id);
    expect(() => createWholesaleOrder(user.id, [{ itemId: "c-ring", qty: 1 }], { type: "dealer", name: "n", address: "a" })).toThrow("resaleCertRequired");
  });

  it("도매 주문: 티어 가격 + 주문 시점 견적 고정 + QC 사진 필수 + 풀 플로우", () => {
    const order = createWholesaleOrder("u-dealer1", [{ itemId: "c-ring", qty: 2 }], { type: "dealer", name: "LA", address: "addr" });
    // T1: stone 750 + metal round(4.2*85*0.75+55)=323 → 1073
    expect(order.items[0].unitUsd).toBe(1073);
    expect(order.totalUsd).toBe(2146);
    expect(order.goldSpotAtOrder).toBe(85);
    expect(() => transitionWholesale(order.id, "QC_PASSED", { qcPhotos: [] })).toThrow("qcPhotosRequired");
    transitionWholesale(order.id, "QC_PASSED", { qcPhotos: ["/assets/lineup-ring.png"] });
    transitionWholesale(order.id, "SHIPPED", { trackingNo: "TRK1" });
    expect(transitionWholesale(order.id, "DELIVERED").status).toBe("DELIVERED");
    expect(() => transitionWholesale(order.id, "SHIPPED")).toThrow();
  });

  it("보증 등록: 12개월 만료 자동 계산", () => {
    const reg = registerWarranty("u-dealer2", { itemId: "c-studs", buyerName: "Buyer", buyerContact: "b@x.com", soldAt: "2026-06-12" });
    expect(reg.warrantyUntil).toBe("2027-06-12");
  });

  it("클레임 풀 플로우: 제출 → 승인(반환 대기) → 반환 수령(샐비지) → 교체", () => {
    const reg = registerWarranty("u-dealer1", { itemId: "c-ring", buyerName: "B", buyerContact: "c", soldAt: "2026-06-01" });
    const claim = submitClaim("u-dealer1", { regId: reg.id, defectType: "setting", desc: "프롱 풀림. 연락 010-1234-5678", photos: ["p.png"] });
    expect(claim.desc).not.toContain("010-1234-5678"); // 마스킹
    adjudicateClaim(claim.id, "approve", "교체 승인");
    expect(claim.status).toBe("AWAITING_RETURN");
    receiveClaimReturn(claim.id, { goldGrams: 4.2, stoneToPool: true });
    expect(claim.salvage.creditUsd).toBe(Math.round(4.2 * 85 * 0.75)); // 268
    expect(listSalvage().length).toBe(1);
    markClaimReplaced(claim.id);
    expect(claim.status).toBe("REPLACED");
  });

  it("클레임 반려는 종결", () => {
    const claim = submitClaim("u-dealer1", { regId: "wr-1", defectType: "plating", desc: "", photos: [] });
    adjudicateClaim(claim.id, "deny", "제3자 가공 흔적");
    expect(claim.status).toBe("DENIED");
    expect(() => receiveClaimReturn(claim.id, { goldGrams: 1, stoneToPool: false })).toThrow();
  });

  it("티어 산정: 시드 dealer1은 이번 분기 볼륨으로 T1, 오버라이드 우선", () => {
    expect(dealerTierInfo("u-dealer1", new Date("2026-06-12")).tier).toBe(1);
    expect(dealerTierInfo("u-dealer2", new Date("2026-06-12")).tier).toBe(2);
    updateDealerProfile("u-dealer2", { tierOverride: 1 });
    expect(dealerTierInfo("u-dealer2", new Date("2026-06-12")).tier).toBe(1);
  });
});
