import { describe, it, expect, beforeEach } from "vitest";
import { truncateAuth } from "./helpers.js";
import { createMagicLink, verifyMagicLink, loginWithPassword, ensureCustomer, setCustomerPassword } from "../auth.js";
import { drainMail } from "../mailer.js";
import { withTransaction, query } from "../db.js";
import { hashPassword } from "../passwords.js";
import { getSession } from "../session.js";
import { ApiError } from "../errors.js";

beforeEach(async () => { await truncateAuth(); drainMail(); });

describe("magic link", () => {
  it("creates a one-time link, captures mail, and logs in a new guest email", async () => {
    const { raw } = await createMagicLink("New@Example.com", { origin: "http://x" });
    expect(drainMail()).toHaveLength(1);
    const { customer, session } = await verifyMagicLink(raw);
    expect(customer.email).toBe("new@example.com");
    expect(session.id).toBeTruthy();
  });
  it("rejects reuse of a consumed token", async () => {
    const { raw } = await createMagicLink("a@b.com", { origin: "http://x" });
    await verifyMagicLink(raw);
    await expect(verifyMagicLink(raw)).rejects.toMatchObject({ code: "MAGIC_LINK_INVALID" });
  });
});

describe("password login", () => {
  it("logs in an admin and rejects bad credentials", async () => {
    await query("insert into admin_users (email,name,password_hash) values ($1,$2,$3)",
      ["admin@b.com", "Admin", hashPassword("supersecret")]);
    expect((await loginWithPassword("admin@b.com", "supersecret")).principalType).toBe("admin");
    await expect(loginWithPassword("admin@b.com", "nope")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
  it("logs in a customer after they set a password", async () => {
    const c = await withTransaction((cx) => ensureCustomer(cx, "c@b.com"));
    await setCustomerPassword(c.id, "customerpass");
    expect((await loginWithPassword("c@b.com", "customerpass")).principalType).toBe("customer");
  });

  // I3 — unknown email still returns INVALID_CREDENTIALS (dummy verify path)
  it("rejects an unknown email with INVALID_CREDENTIALS", async () => {
    await expect(loginWithPassword("nobody@nowhere.com", "whatever"))
      .rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
});

// M4 — set-password revokes the customer's other sessions
describe("session hardening", () => {
  it("revokes a previously issued session when the customer sets a password", async () => {
    const c = await withTransaction((cx) => ensureCustomer(cx, "rev@b.com"));
    await setCustomerPassword(c.id, "firstpass1");
    const { session } = await loginWithPassword("rev@b.com", "firstpass1");
    expect((await getSession(session.id)).principal_type).toBe("customer");
    // Setting (changing) the password should revoke the existing session.
    await setCustomerPassword(c.id, "secondpass2");
    expect(await getSession(session.id)).toBeNull();
  });
});
