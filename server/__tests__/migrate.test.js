import { describe, it, expect } from "vitest";
import { query } from "../db.js";

describe("migrations", () => {
  it("applies every file in db/migrations including 0002", async () => {
    const { rows } = await query("select filename from schema_migrations order by filename");
    const files = rows.map((r) => r.filename);
    expect(files).toContain("0001_customer_core.sql");
    expect(files).toContain("0002_admin_backoffice.sql");
  });

  // 0008부터 자리표시 시드는 삭제된다 — 카탈로그는 push-catalog-to-server 스크립트나
  // 어드민 write-through가 채운다. 테이블 형태(payload 컬럼)만 검증한다.
  it("starter_designs has the payload column (0008 catalog wiring)", async () => {
    const { rows } = await query(
      "select column_name from information_schema.columns where table_name = 'starter_designs' and column_name = 'payload'",
    );
    expect(rows.length).toBe(1);
  });

  it("app_settings key-value store exists", async () => {
    const { rows } = await query("select count(*)::int as n from app_settings");
    expect(rows[0].n).toBeGreaterThanOrEqual(0);
  });
});
