import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { query } from "../db.js";
import { truncateAuth, truncateActivity } from "./helpers.js";
import { recordEvents, linkSessionToCustomer, EVENT_TYPES } from "../activityRepository.js";

beforeEach(async () => { await truncateAuth(); await truncateActivity(); });

describe("activityRepository", () => {
  it("recordEvents upserts session and inserts whitelisted events", async () => {
    const sid = randomUUID();
    const { inserted } = await recordEvents({
      sessionId: sid, userAgent: "vitest",
      events: [
        { type: "page_view", path: "/" },
        { type: "style_view", path: "/designs/x", entityType: "style", entityId: "ST-1" },
      ],
    });
    expect(inserted).toBe(2);
    const s = await query("select * from activity_sessions where session_id = $1", [sid]);
    expect(s.rows).toHaveLength(1);
    const e = await query("select event_type, entity_id from activity_events where session_id = $1 order by id", [sid]);
    expect(e.rows[1]).toMatchObject({ event_type: "style_view", entity_id: "ST-1" });
  });

  it("client event UUID가 같은 재전송은 한 번만 저장한다", async () => {
    const sid = randomUUID();
    const eventId = randomUUID();
    const first = await recordEvents({ sessionId: sid, events: [{ id: eventId, type: "page_view", path: "/checkout" }] });
    const replay = await recordEvents({ sessionId: sid, events: [{ id: eventId, type: "page_view", path: "/checkout" }] });
    expect(first.inserted).toBe(1);
    expect(replay.inserted).toBe(0);
    const { rows } = await query("select count(*)::int as n from activity_events where client_event_id = $1", [eventId]);
    expect(rows[0].n).toBe(1);
  });

  it("malformed client event id를 거부한다", async () => {
    await expect(recordEvents({ sessionId: randomUUID(), events: [{ id: "retry-1", type: "page_view" }] }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects non-whitelisted event types", async () => {
    const sid = randomUUID();
    await expect(recordEvents({ sessionId: sid, events: [{ type: "evil" }] }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(EVENT_TYPES.has("evil")).toBe(false);
  });

  it("rejects malformed session ids", async () => {
    await expect(recordEvents({ sessionId: "not-a-uuid", events: [{ type: "page_view" }] }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("linkSessionToCustomer fills customer_id", async () => {
    const sid = randomUUID();
    await recordEvents({ sessionId: sid, events: [{ type: "page_view", path: "/" }] });
    const { rows: [cust] } = await query(
      "insert into customers (customer_code, email, name) values ('C-1','a@b.com','A') returning id");
    await linkSessionToCustomer(sid, cust.id);
    const { rows } = await query("select customer_id from activity_sessions where session_id = $1", [sid]);
    expect(Number(rows[0].customer_id)).toBe(Number(cust.id));
  });
});
