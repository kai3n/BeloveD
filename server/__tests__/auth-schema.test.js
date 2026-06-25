import { describe, it, expect } from "vitest";
import { query } from "../db.js";

async function columns(table) {
  const { rows } = await query(
    "select column_name from information_schema.columns where table_name=$1", [table]);
  return rows.map((r) => r.column_name);
}

describe("0003 auth schema", () => {
  it("has sessions with principal columns", async () => {
    const c = await columns("sessions");
    expect(c).toEqual(expect.arrayContaining(["id", "principal_type", "principal_id", "expires_at", "revoked_at"]));
  });
  it("has magic_link_tokens", async () => {
    const c = await columns("magic_link_tokens");
    expect(c).toEqual(expect.arrayContaining(["token_hash", "email", "intent", "expires_at", "used_at"]));
  });
  it("has admin_users", async () => {
    const c = await columns("admin_users");
    expect(c).toEqual(expect.arrayContaining(["email", "password_hash", "active"]));
  });
  it("added customers.password_hash", async () => {
    expect(await columns("customers")).toContain("password_hash");
  });
});
