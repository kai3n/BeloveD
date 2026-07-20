// 동시 로그인(어드민+고객 쿠키가 같은 브라우저에 공존) 시 principal 해석 회귀 테스트.
// 과거: bd_admin이 있으면 bd_sid를 조회조차 안 해 고객 API가 전부 401 — 주문 포털 재로그인 루프.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../session.js", () => ({ getSession: vi.fn() }));
import { getSession } from "../session.js";
import { attachPrincipal, requireCustomer, requireAdmin, requireFullAdmin } from "../middleware.js";

const ADMIN_ROW = { principal_type: "admin", principal_id: "7" };
const CUSTOMER_ROW = { principal_type: "customer", principal_id: "42" };

function reqWith(cookies) {
  return { cookies };
}

async function attach(req) {
  const next = vi.fn();
  await attachPrincipal(req, {}, next);
  expect(next).toHaveBeenCalledWith();
  return req;
}

beforeEach(() => {
  getSession.mockReset();
  getSession.mockImplementation(async (sid) => (
    sid === "A" ? ADMIN_ROW : sid === "C" ? CUSTOMER_ROW : null
  ));
});

describe("attachPrincipal — 두 세션 동시 해석", () => {
  it("어드민+고객 쿠키 공존: 둘 다 붙고 기본 principal은 admin(콘솔·/auth/me 호환)", async () => {
    const req = await attach(reqWith({ bd_admin: "A", bd_sid: "C" }));
    expect(req.principalAdmin).toEqual({ type: "admin", id: 7 });
    expect(req.principalCustomer).toEqual({ type: "customer", id: 42 });
    expect(req.principal).toEqual({ type: "admin", id: 7 });
  });

  it("고객 쿠키만: principal=customer", async () => {
    const req = await attach(reqWith({ bd_sid: "C" }));
    expect(req.principalAdmin).toBeNull();
    expect(req.principal).toEqual({ type: "customer", id: 42 });
  });

  it("쿠키 없음: 전부 null", async () => {
    const req = await attach(reqWith({}));
    expect(req.principal).toBeNull();
    expect(req.principalCustomer).toBeNull();
  });
});

describe("requireCustomer — 동시 로그인 401 방지", () => {
  it("어드민 쿠키가 함께 있어도 고객 세션으로 통과하고 principal을 고객으로 바꾼다", async () => {
    const req = await attach(reqWith({ bd_admin: "A", bd_sid: "C" }));
    const next = vi.fn();
    requireCustomer(req, {}, next);
    expect(next).toHaveBeenCalledWith(); // 오류 없이 통과
    expect(req.principal).toEqual({ type: "customer", id: 42 }); // 이후 핸들러는 고객으로 동작
  });

  it("어드민 쿠키만 있으면 여전히 401", async () => {
    const req = await attach(reqWith({ bd_admin: "A" }));
    const next = vi.fn();
    requireCustomer(req, {}, next);
    expect(next.mock.calls[0][0]?.code).toBe("CUSTOMER_AUTH_REQUIRED");
  });
});

describe("requireAdmin/requireFullAdmin — 어드민 경로는 기존대로", () => {
  it("동시 로그인에서도 어드민 가드는 admin으로 통과한다", async () => {
    const req = await attach(reqWith({ bd_admin: "A", bd_sid: "C" }));
    const next = vi.fn();
    requireAdmin(req, {}, next);
    expect(next).toHaveBeenCalledWith();
    const next2 = vi.fn();
    requireFullAdmin(req, {}, next2);
    expect(next2).toHaveBeenCalledWith();
    expect(req.principal.type).toBe("admin");
  });
});
