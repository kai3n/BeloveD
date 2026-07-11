import { describe, it, expect } from "vitest";
import { query } from "../db.js";

// 0005_activity.sql이 적용됐는지 — 테이블·핵심 컬럼 존재 확인
describe("activity schema", () => {
  it.each([
    ["activity_sessions", ["session_id", "customer_id", "first_seen", "last_seen", "user_agent"]],
    ["activity_events", ["id", "session_id", "client_event_id", "event_type", "path", "entity_type", "entity_id", "meta", "created_at"]],
    ["activity_daily", ["day", "event_type", "entity_id", "count"]],
  ])("%s has expected columns", async (table, cols) => {
    const { rows } = await query(
      "select column_name from information_schema.columns where table_name = $1", [table]);
    const names = rows.map((r) => r.column_name);
    for (const c of cols) expect(names).toContain(c);
  });
});
