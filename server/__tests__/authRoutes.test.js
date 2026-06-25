import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { truncateAuth } from "./helpers.js";
import { query } from "../db.js";
import { hashPassword } from "../passwords.js";

const app = createApp();
beforeEach(async () => { await truncateAuth(); });

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
});
