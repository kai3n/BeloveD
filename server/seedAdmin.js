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
}

// Only run when invoked directly (so tests can import resolveSeedPassword).
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => closePool());
}
