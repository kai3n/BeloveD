import { describe, expect, it } from "vitest";
import { STATUSES, canTransition, assertTransition } from "../statusMachine.js";

describe("statusMachine", () => {
  it("정의된 전체 상태를 노출한다", () => {
    expect(STATUSES).toContain("PROPOSAL_UPLOADED");
    expect(STATUSES).toContain("ON_HOLD");
  });

  it("핵심 해피패스 전이를 허용한다", () => {
    expect(canTransition("DRAFT", "SUBMITTED", "customer")).toBe(true);
    expect(canTransition("SUBMITTED", "VENDOR_ASSIGNED", "admin")).toBe(true);
    expect(canTransition("VENDOR_ASSIGNED", "PROPOSAL_UPLOADED", "vendor")).toBe(true);
    expect(canTransition("PROPOSAL_UPLOADED", "REVISION_REQUESTED", "customer")).toBe(true);
    expect(canTransition("REVISION_REQUESTED", "PROPOSAL_UPLOADED", "vendor")).toBe(true);
    expect(canTransition("PROPOSAL_UPLOADED", "CONFIRMED", "customer")).toBe(true);
    expect(canTransition("CONFIRMED", "DEPOSIT_PAID", "customer")).toBe(true);
    expect(canTransition("DEPOSIT_PAID", "IN_PRODUCTION", "vendor")).toBe(true);
    expect(canTransition("IN_PRODUCTION", "QUALITY_CHECK", "vendor")).toBe(true);
    expect(canTransition("QUALITY_CHECK", "FINAL_PAYMENT_PAID", "customer")).toBe(true);
    expect(canTransition("FINAL_PAYMENT_PAID", "SHIPPED", "admin")).toBe(true);
    expect(canTransition("SHIPPED", "DELIVERED", "admin")).toBe(true);
    expect(canTransition("DELIVERED", "COMPLETED", "customer")).toBe(true);
  });

  it("역할이 틀리면 거부한다", () => {
    expect(canTransition("SUBMITTED", "VENDOR_ASSIGNED", "vendor")).toBe(false);
    expect(canTransition("VENDOR_ASSIGNED", "PROPOSAL_UPLOADED", "customer")).toBe(false);
    expect(canTransition("PROPOSAL_UPLOADED", "CONFIRMED", "vendor")).toBe(false);
  });

  it("허용되지 않은 점프를 거부한다", () => {
    expect(canTransition("SUBMITTED", "DEPOSIT_PAID", "customer")).toBe(false);
    expect(canTransition("DRAFT", "SHIPPED", "admin")).toBe(false);
    expect(canTransition("CONFIRMED", "IN_PRODUCTION", "vendor")).toBe(false);
  });

  it("검수 실패 시 재제작 루프를 허용한다", () => {
    expect(canTransition("QUALITY_CHECK", "IN_PRODUCTION", "admin")).toBe(true);
  });

  it("운영자는 배정된 주문을 재배정할 수 있다 (SLA 초과 대응)", () => {
    expect(canTransition("VENDOR_ASSIGNED", "VENDOR_ASSIGNED", "admin")).toBe(true);
    expect(canTransition("VENDOR_ASSIGNED", "VENDOR_ASSIGNED", "vendor")).toBe(false);
  });

  it("취소 규칙: 고객은 CONFIRMED까지, 디파짓 후는 운영자만", () => {
    expect(canTransition("SUBMITTED", "CANCELLED", "customer")).toBe(true);
    expect(canTransition("CONFIRMED", "CANCELLED", "customer")).toBe(true);
    expect(canTransition("DEPOSIT_PAID", "CANCELLED", "customer")).toBe(false);
    expect(canTransition("DEPOSIT_PAID", "CANCELLED", "admin")).toBe(true);
    expect(canTransition("COMPLETED", "CANCELLED", "admin")).toBe(false);
    expect(canTransition("PROPOSAL_UPLOADED", "CANCELLED", "vendor")).toBe(false);
  });

  it("assertTransition은 잘못된 전이에 throw한다", () => {
    expect(() => assertTransition("DRAFT", "SHIPPED", "admin")).toThrow(/Invalid transition/);
    expect(() => assertTransition("DRAFT", "SUBMITTED", "customer")).not.toThrow();
  });
});
