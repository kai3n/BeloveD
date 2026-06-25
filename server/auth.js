import { randomBytes } from "node:crypto";
import { query, withTransaction } from "./db.js";
import { ApiError } from "./errors.js";
import { nextCode } from "./codes.js";
import { hashToken, issueSession } from "./session.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { sendMagicLink } from "./mailer.js";

const MAGIC_TTL_MS = 1000 * 60 * 15; // 15 minutes

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function ensureCustomer(client, email, name) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new ApiError("EMAIL_REQUIRED", 400);
  const existing = await client.query("select * from customers where email=$1", [normalized]);
  if (existing.rows[0]) return existing.rows[0];
  const code = await nextCode(client, "CUS");
  const { rows } = await client.query(
    "insert into customers (customer_code, email, name) values ($1,$2,$3) returning *",
    [code, normalized, name || normalized],
  );
  return rows[0];
}

export async function createMagicLink(email, { origin, intent = "login", orderCode = null }) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new ApiError("EMAIL_REQUIRED", 400);
  const raw = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + MAGIC_TTL_MS);
  await query(
    `insert into magic_link_tokens (token_hash, email, intent, order_code, expires_at)
     values ($1,$2,$3,$4,$5)`,
    [hashToken(raw), normalized, intent, orderCode, expiresAt],
  );
  const link = `${origin}/auth/callback?token=${raw}`;
  await sendMagicLink(normalized, link);
  return { email: normalized, link, raw, expiresAt };
}

export async function verifyMagicLink(raw) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      "select * from magic_link_tokens where token_hash=$1 for update", [hashToken(raw)]);
    const token = rows[0];
    if (!token || token.used_at || new Date(token.expires_at) < new Date()) {
      throw new ApiError("MAGIC_LINK_INVALID", 400);
    }
    await client.query("update magic_link_tokens set used_at=now() where token_hash=$1", [hashToken(raw)]);
    const customer = await ensureCustomer(client, token.email);
    const session = await issueSession("customer", customer.id);
    return { session, customer };
  });
}

export async function loginWithPassword(email, password) {
  const normalized = normalizeEmail(email);
  const admin = await query("select * from admin_users where email=$1 and active=true", [normalized]);
  if (admin.rows[0] && verifyPassword(password, admin.rows[0].password_hash)) {
    return { principalType: "admin", session: await issueSession("admin", admin.rows[0].id) };
  }
  const cust = await query("select * from customers where email=$1", [normalized]);
  if (cust.rows[0]?.password_hash && verifyPassword(password, cust.rows[0].password_hash)) {
    return { principalType: "customer", session: await issueSession("customer", cust.rows[0].id) };
  }
  throw new ApiError("INVALID_CREDENTIALS", 401);
}

export async function setCustomerPassword(customerId, password) {
  if (!password || String(password).length < 8) throw new ApiError("INVALID_CREDENTIALS", 400, "password too short");
  await query("update customers set password_hash=$1, updated_at=now() where id=$2",
    [hashPassword(password), customerId]);
}
