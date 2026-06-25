import { query, closePool } from "./db.js";
import { hashPassword } from "./passwords.js";

const email = (process.env.SEED_ADMIN_EMAIL || "admin@belovediamond.test").toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD || "admin12345";

async function run() {
  await query(
    `insert into admin_users (email, name, password_hash) values ($1,$2,$3)
     on conflict (email) do update set password_hash=excluded.password_hash, active=true`,
    [email, "BeloveDiamond Admin", hashPassword(password)],
  );
  console.log(`seeded admin ${email} (password: ${password})`);
}
run().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => closePool());
