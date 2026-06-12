import { beforeEach, describe, expect, it } from "vitest";
import {
  resetDB, listDiamonds, adjustDiamondPrices, saveDiamond,
  createRequest, assignVendor, addProposal, addFeedback, payOrder,
  transitionRequest, getOrderByRequest, anonymizeForVendor, getRequest, listEvents,
} from "../store.js";

const customer = { id: "u-customer", role: "customer" };
const vendor = { id: "u-vendor1", role: "vendor" };
const admin = { id: "u-admin", role: "admin" };

beforeEach(() => resetDB());

describe("store", () => {
  it("시드 다이아 12개, visible 필터", () => {
    expect(listDiamonds().length).toBe(12);
    saveDiamond({ id: "d-1", visible: false });
    expect(listDiamonds().length).toBe(11);
    expect(listDiamonds({ includeHidden: true }).length).toBe(12);
  });

  it("일괄 % 가격 조정", () => {
    const before = listDiamonds()[0].priceUsd;
    adjustDiamondPrices(10);
    expect(listDiamonds()[0].priceUsd).toBeGreaterThan(before);
  });

  it("주문제작 전체 플로우: 제출→배정→시안→수정→시안→컨펌→디파짓→제작→검수→잔금→배송→수령", () => {
    const req = createRequest({ customerId: "u-customer", templateId: "t-1", diamondId: "d-2", details: { metal: "yg18", size: "12", engraving: "", budget: 3800, notes: "" } });
    expect(req.status).toBe("SUBMITTED");
    expect(req.code).toMatch(/^#\d+$/);

    assignVendor(req.id, "u-vendor1", admin);
    const p1 = addProposal(req.id, "u-vendor1", { media: [], comment: "1차 시안. 문의는 010-1234-5678" });
    expect(p1.comment).not.toContain("010-1234-5678"); // 마스킹
    expect(getRequest(req.id).status).toBe("PROPOSAL_UPLOADED");

    addFeedback(p1.id, { decision: "revise", choices: ["band"], comment: "더 얇게요" }, customer);
    expect(getRequest(req.id).status).toBe("REVISION_REQUESTED");

    const p2 = addProposal(req.id, "u-vendor1", { media: [], comment: "2차 시안" });
    const { order } = addFeedback(p2.id, { decision: "confirm", choices: [], comment: "" }, customer);
    expect(getRequest(req.id).status).toBe("CONFIRMED");
    expect(order.totalUsd).toBe(530 + 2450);
    expect(order.depositUsd).toBe(Math.round(order.totalUsd * 0.3));

    payOrder(order.id, "deposit", customer);
    expect(getRequest(req.id).status).toBe("DEPOSIT_PAID");

    transitionRequest(req.id, "IN_PRODUCTION", vendor);
    transitionRequest(req.id, "QUALITY_CHECK", vendor);
    payOrder(order.id, "final", customer);
    expect(getRequest(req.id).status).toBe("FINAL_PAYMENT_PAID");
    expect(getOrderByRequest(req.id).shippingStage).toBe("ready");

    transitionRequest(req.id, "SHIPPED", admin);
    transitionRequest(req.id, "DELIVERED", admin);
    transitionRequest(req.id, "COMPLETED", customer);
    expect(getOrderByRequest(req.id).shippingStage).toBe("delivered");
    expect(listEvents(req.id).length).toBeGreaterThanOrEqual(11); // 감사 로그
  });

  it("잘못된 전이는 throw", () => {
    const req = createRequest({ customerId: "u-customer", templateId: "t-1", diamondId: null, details: {} });
    expect(() => transitionRequest(req.id, "SHIPPED", admin)).toThrow();
    expect(() => addProposal(req.id, "u-vendor1", { media: [], comment: "" })).toThrow(); // 배정 전
  });

  it("벤더 익명화: PII 제거", () => {
    const req = getRequest("req-1001");
    const anon = anonymizeForVendor(req);
    expect(anon.customerId).toBeUndefined();
    expect(anon.customerLabel).toBe("#1001");
    expect(anon.details.metal).toBe("wg18"); // 스펙은 유지
  });
});
