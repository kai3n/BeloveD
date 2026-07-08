import { randomBytes, randomInt } from "node:crypto";
import { query, withTransaction } from "./db.js";
import { ApiError } from "./errors.js";
import { nextCode } from "./codes.js";
import { hashToken, issueSession, revokeAllForPrincipal } from "./session.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { sendMagicLink, sendLoginCode } from "./mailer.js";

const MAGIC_TTL_MS = 1000 * 60 * 15; // 15 minutes
const ADMIN_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours — admin sessions are short-lived

// Constant precomputed scrypt hash used to equalize timing when no user row
// matches (I3) — verifying against it costs the same as a real wrong-password
// check, so an unknown email cannot be distinguished by response latency.
const DUMMY_HASH = hashPassword(randomBytes(32).toString("hex"));

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// 고객이 사이트에서 쓰는 언어 — 주문 메일·OTP 메일이 이 언어로 발송된다.
const LOCALES = new Set(["en", "ko", "zh", "es"]);
export function normalizeLocale(locale) {
  const l = String(locale || "").trim().toLowerCase();
  return LOCALES.has(l) ? l : null;
}

export async function ensureCustomer(client, email, name, locale) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new ApiError("EMAIL_REQUIRED", 400);
  const lang = normalizeLocale(locale);
  const existing = await client.query("select * from customers where email=$1", [normalized]);
  if (existing.rows[0]) {
    // 마지막으로 쓴 언어가 항상 최신 — 로그인 시점의 사이트 언어로 갱신
    if (lang && existing.rows[0].locale !== lang) {
      const { rows } = await client.query(
        "update customers set locale=$1, updated_at=now() where id=$2 returning *",
        [lang, existing.rows[0].id],
      );
      return rows[0];
    }
    return existing.rows[0];
  }
  const code = await nextCode(client, "CUS");
  // 동시 최초 로그인 레이스에서 SELECT-후-INSERT가 UNIQUE 충돌로 500 나지 않게 upsert —
  // 다른 요청이 먼저 만들었으면 기존 행을 반환(트랜잭션 abort 방지).
  const { rows } = await client.query(
    `insert into customers (customer_code, email, name, locale) values ($1,$2,$3,$4)
     on conflict (email) do update set updated_at = now()
     returning *`,
    [code, normalized, name || normalized, lang || "en"],
  );
  return rows[0];
}

export async function createMagicLink(email, { origin, intent = "login", orderCode = null, locale = "en" }) {
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
  await sendMagicLink(normalized, link, normalizeLocale(locale) || "en");
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

const CODE_TTL_MS = 1000 * 60 * 10; // 10 minutes
const CODE_MAX_ATTEMPTS = 5;

// 이메일 6자리 인증번호 발급 — 코드 원문은 메일로만, DB에는 해시만 (M2와 동일 원칙)
export async function createLoginCode(email, locale) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new ApiError("EMAIL_REQUIRED", 400);
  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  // 같은 이메일의 이전 미사용 코드는 폐기 — 항상 마지막 코드 하나만 유효
  await query("update login_codes set used_at=now() where email=$1 and used_at is null", [normalized]);
  await query(
    "insert into login_codes (email, code_hash, expires_at) values ($1,$2,$3)",
    [normalized, hashToken(code), expiresAt],
  );
  await sendLoginCode(normalized, code, normalizeLocale(locale) || "en");
  return { email: normalized, expiresAt, code };
}

export async function verifyLoginCode(email, code, locale) {
  const normalized = normalizeEmail(email);
  // 주의: 실패 시 throw가 트랜잭션을 롤백하면 attempts 증가까지 사라져
  // 브루트포스 제한이 무력화된다 — 증가/폐기는 트랜잭션 밖에서 커밋한다.
  const { rows } = await query(
    `select * from login_codes where email=$1 and used_at is null
     order by created_at desc limit 1`,
    [normalized],
  );
  const row = rows[0];
  if (!row || new Date(row.expires_at) < new Date()) throw new ApiError("CODE_INVALID", 400);
  if (row.attempts >= CODE_MAX_ATTEMPTS) {
    await query("update login_codes set used_at=now() where id=$1", [row.id]);
    throw new ApiError("CODE_INVALID", 400);
  }
  if (hashToken(String(code || "")) !== row.code_hash) {
    await query("update login_codes set attempts=attempts+1 where id=$1", [row.id]);
    throw new ApiError("CODE_INVALID", 400);
  }
  // 단일 사용 보장 — 조건부 갱신은 동시 요청에서도 한 번만 성공한다
  const used = await query(
    "update login_codes set used_at=now() where id=$1 and used_at is null returning id",
    [row.id],
  );
  if (used.rowCount === 0) throw new ApiError("CODE_INVALID", 400);
  return withTransaction(async (client) => {
    const customer = await ensureCustomer(client, normalized, null, locale);
    const session = await issueSession("customer", customer.id);
    return { session, customer };
  });
}

export async function loginWithPassword(email, password) {
  const normalized = normalizeEmail(email);
  const admin = await query("select * from admin_users where email=$1 and active=true", [normalized]);
  if (admin.rows[0] && verifyPassword(password, admin.rows[0].password_hash)) {
    return { principalType: "admin", session: await issueSession("admin", admin.rows[0].id, ADMIN_TTL_MS) };
  }
  const cust = await query("select * from customers where email=$1", [normalized]);
  if (cust.rows[0]?.password_hash && verifyPassword(password, cust.rows[0].password_hash)) {
    // customerId는 activity 세션 연결용 (authRoutes.linkActivity)
    return { principalType: "customer", customerId: cust.rows[0].id, session: await issueSession("customer", cust.rows[0].id) };
  }
  // No matching row: still run one verify against a constant dummy hash so the
  // response time for an unknown email matches a wrong-password attempt (I3).
  verifyPassword(password, DUMMY_HASH);
  throw new ApiError("INVALID_CREDENTIALS", 401);
}

export async function setCustomerPassword(customerId, password) {
  if (!password || String(password).length < 8) throw new ApiError("INVALID_CREDENTIALS", 400, "password too short");
  await query("update customers set password_hash=$1, updated_at=now() where id=$2",
    [hashPassword(password), customerId]);
  // Revoke the customer's other sessions so a stolen cookie can't survive a
  // password (re)set (M4).
  await revokeAllForPrincipal("customer", customerId);
}
