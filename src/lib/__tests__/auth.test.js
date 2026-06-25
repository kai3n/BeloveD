import { beforeEach, describe, expect, it } from "vitest";
import { resetDB, addUser, findUserByEmail, findUserByAccessCode, genAccessCode } from "../store.js";

beforeEach(() => resetDB());

describe("역할별 인증 — 벤더 접근 코드", () => {
  it("접근 코드로 벤더를 조회 (대소문자·공백 무시), 비벤더/오타는 null", () => {
    expect(findUserByAccessCode("cn01-7f3k")?.id).toBe("u-supplier1");
    expect(findUserByAccessCode("  CN01-7F3K  ")?.id).toBe("u-supplier1");
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
