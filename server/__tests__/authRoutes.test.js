import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { createApp } from "../app.js";
import { truncateAuth } from "./helpers.js";
import { query } from "../db.js";
import { hashPassword } from "../passwords.js";
import { __resetRateLimit } from "../rateLimit.js";
import { attachPrincipal, requireAdmin, requireCustomer } from "../middleware.js";

const app = createApp();
beforeEach(async () => { await truncateAuth(); __resetRateLimit(); });
afterEach(() => { delete process.env.PUBLIC_ORIGIN; });

function createProtectedApp() {
  const protectedApp = express();
  protectedApp.use(cookieParser());
  protectedApp.use(attachPrincipal);
  protectedApp.get("/customer-only", requireCustomer, (req, res) => {
    res.json({ principal: req.principal });
  });
  protectedApp.get("/admin-only", requireAdmin, (req, res) => {
    res.json({ principal: req.principal });
  });
  protectedApp.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ error: { code: err.code || "INTERNAL_ERROR" } });
  });
  return protectedApp;
}

async function issueCustomerCookie(email = "guest@b.com") {
  const ml = await request(app).post("/v1/auth/magic-link").send({ email });
  const token = new URL(ml.body.devLink).searchParams.get("token");
  const cb = await request(app).get(`/v1/auth/callback?token=${token}`);
  return cb.headers["set-cookie"];
}

async function issueAdminCookie(email = "admin@b.com") {
  await query("insert into admin_users (email,name,password_hash) values ($1,$2,$3)",
    [email, "Admin", hashPassword("admin12345")]);
  const login = await request(app).post("/v1/auth/password").send({ email, password: "admin12345" });
  return login.headers["set-cookie"];
}

describe("auth routes", () => {
  it("magic-link → callback issues a customer session cookie", async () => {
    const ml = await request(app).post("/v1/auth/magic-link").send({ email: "g@b.com" });
    expect(ml.status).toBe(201);
    const token = new URL(ml.body.devLink).searchParams.get("token");
    const cb = await request(app).get(`/v1/auth/callback?token=${token}`);
    expect(cb.body.principal).toBe("customer");
    expect(cb.headers["set-cookie"].join()).toMatch(/bd_sid=/);
    expect(cb.headers["set-cookie"].join()).toMatch(/SameSite=Lax/i);
  });

  // 매직링크 메일도 OTP처럼 사이트 언어로 발송 — 미지원/누락 로케일은 en 폴백
  it("magic-link locale은 메일 로케일로 전달되고, 미지원 값은 en 폴백", async () => {
    const { drainMail } = await import("../mailer.js");
    drainMail();
    await request(app).post("/v1/auth/magic-link").send({ email: "ko@b.com", locale: "ko" });
    await request(app).post("/v1/auth/magic-link").send({ email: "fr@b.com", locale: "fr" });
    const sent = drainMail();
    expect(sent.find((m) => m.to === "ko@b.com").locale).toBe("ko");
    expect(sent.find((m) => m.to === "ko@b.com").subject).toContain("로그인 링크");
    expect(sent.find((m) => m.to === "fr@b.com").locale).toBe("en");
  });

  it("admin password login sets bd_admin and is rejected on customer routes", async () => {
    await query("insert into admin_users (email,name,password_hash) values ($1,$2,$3)",
      ["admin@b.com", "A", hashPassword("admin12345")]);
    const login = await request(app).post("/v1/auth/password").send({ email: "admin@b.com", password: "admin12345" });
    expect(login.body.principal).toBe("admin");
    const cookie = login.headers["set-cookie"];
    expect(cookie.join()).toMatch(/bd_admin=/);
    expect(cookie.join()).toMatch(/SameSite=Strict/i);
    // admin cookie must NOT satisfy requireCustomer
    const setpw = await request(app).post("/v1/auth/set-password").set("Cookie", cookie).send({ password: "longenough" });
    expect(setpw.status).toBe(401);
    expect(setpw.body.error.code).toBe("CUSTOMER_AUTH_REQUIRED");
  });

  it("customer session cookies are rejected by admin-only routes", async () => {
    const protectedApp = createProtectedApp();
    const cookie = await issueCustomerCookie("customer-only@b.com");
    const customer = await request(protectedApp).get("/customer-only").set("Cookie", cookie);
    expect(customer.status).toBe(200);
    expect(customer.body.principal.type).toBe("customer");

    const admin = await request(protectedApp).get("/admin-only").set("Cookie", cookie);
    expect(admin.status).toBe(401);
    expect(admin.body.error.code).toBe("ADMIN_AUTH_REQUIRED");
  });

  // 과거 회귀: 어드민 쿠키가 있으면 고객 세션을 무시해 고객 API가 전부 401(주문 포털 재로그인 루프).
  // 올바른 동작 — 라우트 성격대로: 어드민 라우트는 admin, 고객 라우트는 customer 세션으로 통과한다.
  it("both cookies: admin routes act as admin, customer routes act as customer (no 401 loop)", async () => {
    const protectedApp = createProtectedApp();
    const customerCookie = await issueCustomerCookie("both@b.com");
    const adminCookie = await issueAdminCookie("both-admin@b.com");
    const bothCookies = [...adminCookie, ...customerCookie];

    const admin = await request(protectedApp).get("/admin-only").set("Cookie", bothCookies);
    expect(admin.status).toBe(200);
    expect(admin.body.principal.type).toBe("admin");

    const customer = await request(protectedApp).get("/customer-only").set("Cookie", bothCookies);
    expect(customer.status).toBe(200);
    expect(customer.body.principal.type).toBe("customer");
  });

  it("admin cookie alone is still rejected by customer-only routes", async () => {
    const protectedApp = createProtectedApp();
    const adminCookie = await issueAdminCookie("only-admin@b.com");
    const customer = await request(protectedApp).get("/customer-only").set("Cookie", adminCookie);
    expect(customer.status).toBe(401);
    expect(customer.body.error.code).toBe("CUSTOMER_AUTH_REQUIRED");
  });

  it("logout revokes the session so /me is anonymous", async () => {
    const ml = await request(app).post("/v1/auth/magic-link").send({ email: "g2@b.com" });
    const token = new URL(ml.body.devLink).searchParams.get("token");
    const cb = await request(app).get(`/v1/auth/callback?token=${token}`);
    const cookie = cb.headers["set-cookie"];
    expect((await request(app).get("/v1/auth/me").set("Cookie", cookie)).body.principal.type).toBe("customer");
    await request(app).post("/v1/auth/logout").set("Cookie", cookie);
    expect((await request(app).get("/v1/auth/me").set("Cookie", cookie)).body.principal).toBeNull();
  });

  // I2 — rate limiting
  it("rate-limits /magic-link and returns 429 RATE_LIMITED on the 6th request", async () => {
    let last;
    for (let i = 0; i < 6; i++) {
      last = await request(app).post("/v1/auth/magic-link").send({ email: `flood${i}@b.com` });
    }
    expect(last.status).toBe(429);
    expect(last.body.error.code).toBe("RATE_LIMITED");
  });

  // I6 — type validation
  it("rejects /password with a non-string password as 400 VALIDATION_ERROR", async () => {
    const res = await request(app)
      .post("/v1/auth/password")
      .send({ email: "a@b.com", password: ["x", "y"] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  // durable brute-force lockout — in-memory limiter는 서버리스에서 무력하므로 DB 잠금 검증
  it("locks /password after 10 failed attempts for an email, even with the correct password", async () => {
    await query("insert into admin_users (email,name,password_hash) values ($1,$2,$3)",
      ["lock@b.com", "Admin", hashPassword("admin12345")]);
    for (let i = 0; i < 10; i += 1) {
      __resetRateLimit(); // in-memory 한도를 매번 비워 DB 잠금만 남긴다
      await request(app).post("/v1/auth/password")
        .send({ email: "lock@b.com", password: "wrong" }).expect(401);
    }
    __resetRateLimit();
    const res = await request(app).post("/v1/auth/password")
      .send({ email: "lock@b.com", password: "admin12345" });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
  });

  it("rejects /magic-link with a non-string email as 400 VALIDATION_ERROR", async () => {
    const res = await request(app).post("/v1/auth/magic-link").send({ email: { evil: true } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  // I5 — CSRF/Origin check
  it("rejects a state-changing POST with a mismatching Origin when PUBLIC_ORIGIN is set", async () => {
    process.env.PUBLIC_ORIGIN = "https://app.example.com";
    const res = await request(app)
      .post("/v1/auth/magic-link")
      .set("Origin", "https://evil.com")
      .send({ email: "victim@b.com" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
  });

  it("allows a state-changing POST with a matching Origin", async () => {
    process.env.PUBLIC_ORIGIN = "https://app.example.com";
    const res = await request(app)
      .post("/v1/auth/magic-link")
      .set("Origin", "https://app.example.com")
      .send({ email: "ok@b.com" });
    expect(res.status).toBe(201);
  });

  it("allows a state-changing POST with no Origin header even when PUBLIC_ORIGIN is set", async () => {
    process.env.PUBLIC_ORIGIN = "https://app.example.com";
    const res = await request(app).post("/v1/auth/magic-link").send({ email: "native@b.com" });
    expect(res.status).toBe(201);
  });
});
