// 2단계 어드민 — bot_admin은 돈 관련 작업(설정 저장·제안 발송·결제 확인·잔금 요청·취소)에서 403,
// 나머지(다이아/IGI 입력·제작 단계·조회)는 full admin과 동일하게 동작해야 한다.
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { query } from "../db.js";
import { hashPassword } from "../passwords.js";
import { __resetRateLimit } from "../rateLimit.js";
import { drainMail } from "../mailer.js";
import { truncateAuth, truncateCustomerCore } from "./helpers.js";
import { resolveBotSeed } from "../seedAdmin.js";

const app = createApp();

beforeEach(async () => {
  __resetRateLimit();
  await truncateCustomerCore();
  await truncateAuth();
  await query("delete from login_codes");
  drainMail();
});

async function staffCookie(role) {
  const email = role === "bot" ? "bot@b.com" : "adm@b.com";
  await query("insert into admin_users (email,name,password_hash,role) values ($1,$2,$3,$4)",
    [email, role, hashPassword("admin12345"), role === "bot" ? "bot" : "full"]);
  const login = await request(app).post("/v1/auth/password").send({ email, password: "admin12345" });
  return { cookie: login.headers["set-cookie"], principal: login.body.principal };
}

async function submitOrder(email) {
  const res = await request(app).post("/v1/intakes").send({
    email, name: "Bot Tester", locale: "ko",
    category: "ring", productLine: "solitaire", termsAccepted: true, conditional: { ringSize: "6" },
  });
  return res.body.orderCode;
}

describe("bot_admin 권한 경계", () => {
  it("bot 로그인은 principal이 bot_admin으로 발급된다", async () => {
    const { principal } = await staffCookie("bot");
    expect(principal).toBe("bot_admin");
  });

  it("조회(주문 목록)는 bot_admin도 200", async () => {
    await submitOrder("view@test.com");
    const { cookie } = await staffCookie("bot");
    const res = await request(app).get("/v1/admin/orders").set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("돈 관련 이벤트는 403, 비중요 이벤트는 201", async () => {
    const orderCode = await submitOrder("events@test.com");
    const { cookie } = await staffCookie("bot");
    for (const type of ["proposal_sent", "deposit_confirmed", "balance_requested", "balance_confirmed", "order_cancelled"]) {
      const res = await request(app).post(`/v1/admin/orders/${orderCode}/events`).set("Cookie", cookie).send({ type, data: {} });
      expect(res.status, type).toBe(403);
      expect(res.body.error?.code || res.body.code).toBe("FULL_ADMIN_REQUIRED");
    }
    // 다이아/IGI 입력이 담기는 이벤트 — bot 허용
    const ok = await request(app).post(`/v1/admin/orders/${orderCode}/events`).set("Cookie", cookie)
      .send({ type: "diamond_locked", data: { igiNo: "LG-TEST-123" } });
    expect(ok.status).toBe(201);
  });

  it("설정 저장(PUT /admin/settings)은 bot 403 · full 200, 조회는 둘 다 200", async () => {
    const bot = await staffCookie("bot");
    expect((await request(app).put("/v1/admin/settings").set("Cookie", bot.cookie).send({ coupons: [] })).status).toBe(403);
    expect((await request(app).get("/v1/admin/settings").set("Cookie", bot.cookie)).status).toBe(200);
    const full = await staffCookie("full");
    expect((await request(app).put("/v1/admin/settings").set("Cookie", full.cookie).send({ coupons: [] })).status).toBe(200);
  });

  it("full admin은 돈 관련 이벤트도 그대로 가능 (회귀 확인)", async () => {
    const orderCode = await submitOrder("full@test.com");
    const { cookie, principal } = await staffCookie("full");
    expect(principal).toBe("admin");
    const res = await request(app).post(`/v1/admin/orders/${orderCode}/events`).set("Cookie", cookie)
      .send({ type: "proposal_sent", data: { totalUsd: 1000 } });
    expect(res.status).toBe(201);
  });
});

describe("resolveBotSeed", () => {
  it("미설정이면 null (봇 시드 스킵)", () => {
    expect(resolveBotSeed({})).toBeNull();
  });
  it("한쪽만 설정하면 에러", () => {
    expect(() => resolveBotSeed({ BOT_ADMIN_EMAIL: "b@x.com" })).toThrow();
  });
  it("짧은 비밀번호 거부", () => {
    expect(() => resolveBotSeed({ BOT_ADMIN_EMAIL: "b@x.com", BOT_ADMIN_PASSWORD: "short" })).toThrow();
  });
  it("정상 설정은 소문자 이메일로 반환", () => {
    expect(resolveBotSeed({ BOT_ADMIN_EMAIL: "Bot@X.com", BOT_ADMIN_PASSWORD: "longenough" }))
      .toEqual({ email: "bot@x.com", password: "longenough" });
  });
});
