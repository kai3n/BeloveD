import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { query } from "../db.js";
import { truncateActivity } from "./helpers.js";
import { recordEvents } from "../activityRepository.js";
import { runActivityMaintenance } from "../activityMaintenance.js";

beforeEach(async () => { await truncateActivity(); });

describe("activity maintenance", () => {
  it("rolls up finished days into activity_daily and prunes >90d events", async () => {
    const sid = randomUUID();
    await recordEvents({ sessionId: sid, events: [{ type: "page_view", path: "/" }] });
    // 어제 발생한 이벤트와 100일 지난 이벤트를 직접 심는다
    await query(`insert into activity_events (session_id, event_type, created_at)
                 values ($1,'page_view', now() - interval '1 day'),
                        ($1,'style_view', now() - interval '100 days')`, [sid]);
    const out = await runActivityMaintenance();
    expect(out.prunedEvents).toBe(1); // 100일짜리만 삭제
    const { rows } = await query(
      "select count::int from activity_daily where event_type='page_view' and day = (now() - interval '1 day')::date");
    expect(rows[0].count).toBe(1); // 어제 page_view 집계
    // 오늘 이벤트는 원본에 그대로 남는다
    const { rows: [today] } = await query(
      "select count(*)::int as n from activity_events where created_at >= date_trunc('day', now())");
    expect(today.n).toBe(1);
  });

  it("prunes stale unlinked sessions only", async () => {
    const stale = randomUUID();
    const linked = randomUUID();
    await query(`insert into activity_sessions (session_id, last_seen) values ($1, now() - interval '120 days')`, [stale]);
    const { rows: [cust] } = await query(
      "insert into customers (customer_code,email,name) values ('C-2','x@b.com','X') returning id");
    await query(`insert into activity_sessions (session_id, customer_id, last_seen) values ($1, $2, now() - interval '120 days')`, [linked, cust.id]);
    const out = await runActivityMaintenance();
    expect(out.prunedSessions).toBe(1);
    const { rows } = await query("select session_id from activity_sessions");
    expect(rows.map((r) => r.session_id)).toContain(linked);
  });
});
