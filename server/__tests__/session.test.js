import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../passwords.js";
import { issueSession, getSession, revokeSession } from "../session.js";

describe("passwords", () => {
  it("verifies a correct password and rejects a wrong one", () => {
    const h = hashPassword("hunter2");
    expect(verifyPassword("hunter2", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
  });
});

describe("sessions", () => {
  it("issues a session that resolves, then revokes it", async () => {
    const { id } = await issueSession("admin", 1);
    expect((await getSession(id)).principal_type).toBe("admin");
    await revokeSession(id);
    expect(await getSession(id)).toBeNull();
  });
  it("does not resolve an expired session", async () => {
    const { id } = await issueSession("customer", 2, -1000);
    expect(await getSession(id)).toBeNull();
  });
});
