import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createApp } from "../app.js";
import { query } from "../db.js";
import { truncateAuth, truncateActivity } from "./helpers.js";
import { hashPassword } from "../passwords.js";
import { __resetRateLimit } from "../rateLimit.js";
import { recordEvents, linkSessionToCustomer } from "../activityRepository.js";

const app = createApp();
beforeEach(async () => { await truncateAuth(); await truncateActivity(); __resetRateLimit(); });

async function adminCookie() {
  await query("insert into admin_users (email,name,password_hash) values ($1,$2,$3)",
    ["adm@b.com", "Adm", hashPassword("admin12345")]);
  const login = await request(app).post("/v1/auth/password").send({ email: "adm@b.com", password: "admin12345" });
  return login.headers["set-cookie"];
}

async function seedActivity() {
  const sid = randomUUID();
  await recordEvents({ sessionId: sid, events: [
    { type: "page_view", path: "/" },
    { type: "style_view", entityType: "style", entityId: "ST-1" },
    { type: "style_click", entityType: "style", entityId: "ST-1" },
    { type: "intake_start" }, { type: "intake_submit" },
  ]});
  const { rows: [cust] } = await query(
    "insert into customers (customer_code,email,name) values ('C-9','m@b.com','Mina') returning id");
  await linkSessionToCustomer(sid, cust.id);
  return { sid, customerId: Number(cust.id) };
}

describe("admin activity APIs", () => {
  it("401 without admin session", async () => {
    expect((await request(app).get("/v1/admin/activity/overview")).status).toBe(401);
    expect((await request(app).get("/v1/admin/members")).status).toBe(401);
  });

  it("overview returns kpi/topStyles/funnel/trend", async () => {
    await seedActivity();
    const res = await request(app).get("/v1/admin/activity/overview").set("Cookie", await adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.kpi.sessionsToday).toBe(1);
    expect(res.body.topStyles[0]).toMatchObject({ entityId: "ST-1", views: 1, clicks: 1 });
    expect(res.body.funnel).toMatchObject({ styleViews: 1, intakeStarts: 1, intakeSubmits: 1 });
    expect(Array.isArray(res.body.trend)).toBe(true);
  });

  it("members list + timeline", async () => {
    const { customerId } = await seedActivity();
    const cookie = await adminCookie();
    const list = await request(app).get("/v1/admin/members").set("Cookie", cookie);
    expect(list.status).toBe(200);
    const m = list.body.members.find((x) => x.id === customerId);
    expect(m).toMatchObject({ email: "m@b.com", eventCount: 5, orderCount: 0 });
    const tl = await request(app).get(`/v1/admin/members/${customerId}/timeline`).set("Cookie", cookie);
    expect(tl.status).toBe(200);
    expect(tl.body.events.length).toBe(5);
    expect(tl.body.events[0].type).toBe("intake_submit"); // 최신순
  });
});
