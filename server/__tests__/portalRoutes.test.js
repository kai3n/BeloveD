// 고객 포털 GET — 세션 쿠키로 자기 주문만 조회, 타인 주문은 403
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { query } from "../db.js";
import { __resetRateLimit } from "../rateLimit.js";
import { drainMail } from "../mailer.js";
import { truncateCustomerCore } from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  __resetRateLimit();
  await truncateCustomerCore();
  await query("delete from login_codes");
  await query("delete from sessions");
  drainMail();
});

async function loginCookie(email) {
  const res = await request(app).post("/v1/auth/code").send({ email });
  const verify = await request(app).post("/v1/auth/code/verify").send({ email, code: res.body.devCode });
  return verify.headers["set-cookie"];
}

async function submitOrder(email) {
  const res = await request(app).post("/v1/intakes").send({
    email, name: "Portal Tester", locale: "en",
    category: "ring", productLine: "solitaire", termsAccepted: true,
    conditional: { ringSize: "6" },
  });
  expect(res.status).toBe(201);
  return res.body.orderCode;
}

describe("고객 포털 읽기 API", () => {
  it("비로그인 조회는 401", async () => {
    const res = await request(app).get("/v1/orders");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("CUSTOMER_AUTH_REQUIRED");
  });

  it("내 주문 목록 + 상세(단계·타임라인 포함)를 돌려준다", async () => {
    const orderCode = await submitOrder("portal@test.com");
    const cookie = await loginCookie("portal@test.com");

    const list = await request(app).get("/v1/orders").set("Cookie", cookie);
    expect(list.status).toBe(200);
    expect(list.body.orders.map((o) => o.orderCode)).toContain(orderCode);
    expect(list.body.orders[0].stage).toBe("OPS_REVIEW");

    const detail = await request(app).get(`/v1/orders/${orderCode}`).set("Cookie", cookie);
    expect(detail.status).toBe(200);
    expect(detail.body.order.orderCode).toBe(orderCode);
    expect(detail.body.order.phases.length).toBeGreaterThan(0);
    expect(detail.body.order.timeline[0].title).toBe("Request received");
  });

  it("남의 주문 상세는 403", async () => {
    const orderCode = await submitOrder("owner@test.com");
    const cookie = await loginCookie("stranger@test.com");
    const res = await request(app).get(`/v1/orders/${orderCode}`).set("Cookie", cookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ORDER_ACCESS_DENIED");
  });
});
