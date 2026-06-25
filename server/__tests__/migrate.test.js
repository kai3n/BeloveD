import { describe, it, expect } from "vitest";
import { query } from "../db.js";

describe("migrations", () => {
  it("applies every file in db/migrations including 0002", async () => {
    const { rows } = await query("select filename from schema_migrations order by filename");
    const files = rows.map((r) => r.filename);
    expect(files).toContain("0001_customer_core.sql");
    expect(files).toContain("0002_admin_backoffice.sql");
  });

  it("created the starter_designs table with seeded rows", async () => {
    const { rows } = await query("select count(*)::int as n from starter_designs");
    expect(rows[0].n).toBeGreaterThanOrEqual(4);
  });
});
