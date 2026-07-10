import { randomBytes } from "node:crypto";
import { query, closePool } from "./db.js";
import { hashPassword } from "./passwords.js";

const MIN_PASSWORD_LEN = 9;

// Resolve the admin seed password, failing closed in production.
export function resolveSeedPassword(env = process.env) {
  const provided = env.SEED_ADMIN_PASSWORD;
  if (env.NODE_ENV === "production") {
    if (!provided) {
      throw new Error("SEED_ADMIN_PASSWORD is required in production; refusing to seed a default admin password");
    }
    if (provided.length < MIN_PASSWORD_LEN) {
      throw new Error(`SEED_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LEN} characters`);
    }
    return { password: provided, generated: false };
  }
  if (provided) {
    if (provided.length < MIN_PASSWORD_LEN) {
      throw new Error(`SEED_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LEN} characters`);
    }
    return { password: provided, generated: false };
  }
  // Non-prod with nothing set: generate a strong random password so no
  // predictable default ("admin12345") is ever planted.
  return { password: randomBytes(18).toString("base64url"), generated: true };
}

const email = (process.env.SEED_ADMIN_EMAIL || "admin@belovediamond.test").toLowerCase();

// 봇 어드민(제한 세션) — BOT_ADMIN_EMAIL/BOT_ADMIN_PASSWORD가 둘 다 있을 때만 시드.
// 비밀번호 원문은 어디에도 로깅하지 않는다.
export function resolveBotSeed(env = process.env) {
  const botEmail = (env.BOT_ADMIN_EMAIL || "").trim().toLowerCase();
  const botPassword = env.BOT_ADMIN_PASSWORD;
  if (!botEmail && !botPassword) return null; // 미설정 — 봇 시드 스킵
  if (!botEmail || !botPassword) {
    throw new Error("BOT_ADMIN_EMAIL and BOT_ADMIN_PASSWORD must be set together");
  }
  if (botPassword.length < MIN_PASSWORD_LEN) {
    throw new Error(`BOT_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LEN} characters`);
  }
  return { email: botEmail, password: botPassword };
}

async function run() {
  const { password, generated } = resolveSeedPassword();
  await query(
    `insert into admin_users (email, name, password_hash) values ($1,$2,$3)
     on conflict (email) do update set password_hash=excluded.password_hash, active=true`,
    [email, "BeloveDiamond Admin", hashPassword(password)],
  );
  if (process.env.NODE_ENV === "production") {
    // Never log the cleartext password in production.
    console.log(`seeded admin ${email}`);
  } else if (generated) {
    // Log only guidance — never the generated cleartext. Re-run with
    // SEED_ADMIN_PASSWORD set to choose a known password.
    console.log(`seeded admin ${email} with a randomly generated password (not logged).`);
    console.log("Set SEED_ADMIN_PASSWORD to choose a known password, then re-run seed:admin.");
  } else {
    console.log(`seeded admin ${email} (using SEED_ADMIN_PASSWORD)`);
  }

  const bot = resolveBotSeed();
  if (bot) {
    await query(
      `insert into admin_users (email, name, password_hash, role) values ($1,$2,$3,'bot')
       on conflict (email) do update set password_hash=excluded.password_hash, role='bot', active=true`,
      [bot.email, "BeloveDiamond Bot", hashPassword(bot.password)],
    );
    console.log(`seeded bot admin ${bot.email}`);
  }
}

// Only run when invoked directly (so tests can import resolveSeedPassword).
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => closePool());
}
