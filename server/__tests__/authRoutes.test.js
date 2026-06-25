import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { truncateAuth } from "./helpers.js";
import { query } from "../db.js";
import { hashPassword } from "../passwords.js";
import { __resetRateLimit } from "../rateLimit.js";

const app = createApp();
beforeEach(async () => { await truncateAuth(); __resetRateLimit(); });
afterEach(() => { delete process.env.PUBLIC_ORIGIN; });

describe("auth routes", () => {
  it("magic-link → callback issues a customer session cookie", async () => {
    const ml = await request(app).post("/v1/auth/magic-link").send({ email: "g@b.com" });
    expect(ml.status).toBe(201);
    const token = new URL(ml.body.devLink).searchParams.get("token");
    const cb = await request(app).get(`/v1/auth/callback?token=${token}`);
    expect(cb.body.principal).toBe("customer");
    expect(cb.headers["set-cookie"].join()).toMatch(/bd_sid=/);
  });

  it("admin password login sets bd_admin and is rejected on customer routes", async () => {
    await query("insert into admin_users (email,name,password_hash) values ($1,$2,$3)",
      ["admin@b.com", "A", hashPassword("admin12345")]);
    const login = await request(app).post("/v1/auth/password").send({ email: "admin@b.com", password: "admin12345" });
    expect(login.body.principal).toBe("admin");
    const cookie = login.headers["set-cookie"];
    // admin cookie must NOT satisfy requireCustomer
    const setpw = await request(app).post("/v1/auth/set-password").set("Cookie", cookie).send({ password: "longenough" });
    expect(setpw.status).toBe(401);
    expect(setpw.body.error.code).toBe("CUSTOMER_AUTH_REQUIRED");
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
