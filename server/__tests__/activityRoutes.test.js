import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createApp } from "../app.js";
import { query } from "../db.js";
import { truncateAuth, truncateActivity } from "./helpers.js";
import { __resetRateLimit } from "../rateLimit.js";

const app = createApp();
beforeEach(async () => { await truncateAuth(); await truncateActivity(); __resetRateLimit(); });

describe("POST /v1/activity", () => {
  it("records a batch and returns 204", async () => {
    const sid = randomUUID();
    const res = await request(app).post("/v1/activity")
      .set("Cookie", [`bd_aid=${sid}`])
      .send({ events: [{ type: "page_view", path: "/" }, { type: "style_click", entityType: "style", entityId: "ST-9" }] });
    expect(res.status).toBe(204);
    const { rows } = await query("select count(*)::int as n from activity_events where session_id = $1", [sid]);
    expect(rows[0].n).toBe(2);
  });

  it("accepts sendBeacon text/plain bodies", async () => {
    const sid = randomUUID();
    const res = await request(app).post("/v1/activity")
      .set("Cookie", [`bd_aid=${sid}`])
      .set("Content-Type", "text/plain")
      .send(JSON.stringify({ events: [{ type: "page_view", path: "/x" }] }));
    expect(res.status).toBe(204);
    const { rows } = await query("select count(*)::int as n from activity_events where session_id = $1", [sid]);
    expect(rows[0].n).toBe(1);
  });

  it("동일 UUID sendBeacon 배치를 재전송해도 분석 이벤트가 중복되지 않는다", async () => {
    const sid = randomUUID();
    const eventId = randomUUID();
    const payload = JSON.stringify({ events: [{ id: eventId, type: "page_view", path: "/leaving" }] });
    const first = await request(app).post("/v1/activity")
      .set("Cookie", [`bd_aid=${sid}`]).set("Content-Type", "text/plain").send(payload);
    const replay = await request(app).post("/v1/activity")
      .set("Cookie", [`bd_aid=${sid}`]).set("Content-Type", "text/plain").send(payload);
    expect(first.status).toBe(204);
    expect(replay.status).toBe(204);
    const { rows } = await query("select count(*)::int as n from activity_events where client_event_id = $1", [eventId]);
    expect(rows[0].n).toBe(1);
  });

  it("400 on unknown type / oversized batch / missing cookie", async () => {
    const sid = randomUUID();
    const bad = await request(app).post("/v1/activity").set("Cookie", [`bd_aid=${sid}`])
      .send({ events: [{ type: "nope" }] });
    expect(bad.status).toBe(400);
    const big = await request(app).post("/v1/activity").set("Cookie", [`bd_aid=${sid}`])
      .send({ events: Array.from({ length: 26 }, () => ({ type: "page_view" })) });
    expect(big.status).toBe(400);
    const noCookie = await request(app).post("/v1/activity").send({ events: [{ type: "page_view" }] });
    expect(noCookie.status).toBe(400);
  });
});

describe("auth link", () => {
  it("customer login links bd_aid session and records login event", async () => {
    const sid = randomUUID();
    const ml = await request(app).post("/v1/auth/magic-link").send({ email: "t@b.com" });
    const token = new URL(ml.body.devLink).searchParams.get("token");
    const cb = await request(app).get(`/v1/auth/callback?token=${token}`).set("Cookie", [`bd_aid=${sid}`]);
    expect(cb.status).toBe(200);
    const { rows: [s] } = await query("select customer_id from activity_sessions where session_id = $1", [sid]);
    expect(s.customer_id).not.toBeNull();
    const { rows: [e] } = await query(
      "select count(*)::int as n from activity_events where session_id = $1 and event_type in ('login','signup')", [sid]);
    expect(e.n).toBe(1);
  });
});
