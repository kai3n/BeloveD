import { describe, it, expect } from "vitest";
import { resolveSeedPassword } from "../seedAdmin.js";

describe("seedAdmin password resolution (I4)", () => {
  it("refuses to seed in production without SEED_ADMIN_PASSWORD", () => {
    expect(() => resolveSeedPassword({ NODE_ENV: "production" }))
      .toThrow(/SEED_ADMIN_PASSWORD is required/);
  });

  it("rejects a too-short provided password in production", () => {
    expect(() => resolveSeedPassword({ NODE_ENV: "production", SEED_ADMIN_PASSWORD: "short" }))
      .toThrow(/at least 9/);
  });

  it("accepts a strong provided password in production", () => {
    const r = resolveSeedPassword({ NODE_ENV: "production", SEED_ADMIN_PASSWORD: "averystrongpw" });
    expect(r).toEqual({ password: "averystrongpw", generated: false });
  });

  it("generates a random password in non-prod when unset (never the old default)", () => {
    const r = resolveSeedPassword({ NODE_ENV: "development" });
    expect(r.generated).toBe(true);
    expect(r.password).not.toBe("admin12345");
    expect(r.password.length).toBeGreaterThanOrEqual(10);
  });

  it("enforces min length on a provided password in non-prod too", () => {
    expect(() => resolveSeedPassword({ NODE_ENV: "development", SEED_ADMIN_PASSWORD: "short" }))
      .toThrow(/at least 9/);
  });
});
