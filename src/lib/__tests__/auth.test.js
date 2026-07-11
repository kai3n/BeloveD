import { beforeEach, describe, expect, it } from "vitest";
import {
  resetDB, addUser, findUserByEmail, findUserByAccessCode, genAccessCode,
  listOpsOrders, portalView,
} from "../store.js";
import { DEMO_AUTH_ENABLED, DEMO_AUTH_PASSWORD } from "../flags.js";

beforeEach(() => resetDB());

describe("인증 개발 기능 기본값", () => {
  it("명시적인 Vite 플래그 없이는 데모 비밀번호와 화면 OTP가 비활성이다", () => {
    expect(DEMO_AUTH_ENABLED).toBe(false);
    expect(DEMO_AUTH_PASSWORD).toBe("");
  });
});

describe("역할별 인증 — 벤더 접근 코드", () => {
  it("접근 코드로 벤더를 조회 (대소문자·공백 무시), 비벤더/오타는 null", () => {
    expect(findUserByAccessCode("demo-a001")?.id).toBe("u-supplier1");
    expect(findUserByAccessCode("  DEMO-A001  ")?.id).toBe("u-supplier1");
    expect(findUserByAccessCode("WRONG-CODE")).toBeNull();
    expect(findUserByAccessCode("")).toBeNull();
  });

  it("벤더 발급 시 접근 코드 자동 생성, 고객은 코드 없음", () => {
    const vendor = addUser({ email: "atelier3@x.com", name: "ATELIER-03", role: "supplier" });
    expect(vendor.accessCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(findUserByAccessCode(vendor.accessCode)?.id).toBe(vendor.id);
    const customer = addUser({ email: "c2@x.com", name: "C2", role: "customer" });
    expect(customer.accessCode).toBeUndefined();
  });

  it("발급 코드는 매번 달라진다", () => {
    const a = genAccessCode(); const b = genAccessCode();
    expect(a).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(a).not.toBe(b);
  });

  it("이메일 조회는 코드와 별개 — 고객은 이메일로만", () => {
    expect(findUserByEmail("customer@demo.com")?.role).toBe("customer");
    expect(findUserByAccessCode("customer@demo.com")).toBeNull();
  });
});

describe("고객 포털 권한 — 게스트 / 회원 / 어드민 분리", () => {
  it("게스트는 주문 ID와 조회 코드가 모두 맞을 때만 주문을 볼 수 있다", () => {
    expect(portalView("DM-000001", { queryCode: " qx7k-m9p2 " })?.order.id).toBe("DM-000001");
    expect(portalView("DM-000001", { queryCode: "WRONG-CODE" })).toBeNull();
    expect(portalView("DM-000001", {})).toBeNull();
  });

  it("로그인 회원은 자기 주문만 조회하고, 조회 코드로 남의 주문을 우회할 수 없다", () => {
    expect(portalView("DM-000001", { customerId: "u-customer" })?.order.id).toBe("DM-000001");
    expect(portalView("DM-000002", { customerId: "u-customer", queryCode: "H3WT-8RVK" })).toBeNull();
    expect(portalView("DM-000001", { customerId: "u-admin", queryCode: "WRONG-CODE" })).toBeNull();
  });

  it("어드민은 정확한 조회 코드가 있을 때 고객 포털을 미리 볼 수 있다", () => {
    expect(portalView("DM-000001", { customerId: "u-admin", queryCode: "QX7K-M9P2" })?.order.id).toBe("DM-000001");
  });

  it("회원 마이페이지 목록은 customerId 소유 주문만 반환한다", () => {
    const ownOrders = listOpsOrders({ customerId: "u-customer" });
    expect(ownOrders.map((order) => order.id)).toEqual(["DM-000001"]);
    expect(ownOrders.every((order) => order.customerId === "u-customer")).toBe(true);
  });

  it("고객 포털 projection은 내부 운영 필드를 노출하지 않는다", () => {
    const view = portalView("DM-000001", { customerId: "u-customer" });
    expect(view.order.queryCode).toBeUndefined();
    expect(view.order.internalNotes).toBeUndefined();
    expect(view.order.owner).toBeUndefined();
    expect(view.candidates).toBeUndefined(); // 확정 제안 flow: 후보는 고객 미노출
    const json = JSON.stringify(view);
    expect(json).not.toContain("procurementCostUsd");
    expect(json).not.toContain("supplierId");
    expect(json).not.toContain("internalNotes");
  });
});
